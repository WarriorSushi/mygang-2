import { google } from '@ai-sdk/google'
import { embed, generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { openRouterModel } from '@/lib/ai/openrouter'
import { getMemoryMaxCount, getMemoryInPromptLimit, type SubscriptionTier } from '@/lib/billing'

const embeddingModel = google.textEmbeddingModel('text-embedding-004')

/** Category priority: additive tiebreaker for composite scoring (max +0.06).
 *  Stable identity and inside jokes beat bland topical memories when scores are close. */
export const CATEGORY_PRIORITY: Record<string, number> = {
    identity: 0.06,
    inside_joke: 0.05,
    life_event: 0.04,
    relationship: 0.03,
    preference: 0.02,
    routine: 0.01,
    mood: 0.01,
    topic: 0.00,
}

const STOPWORDS = new Set([
    'the','a','an','and','or','but','if','then','else','when','to','of','in','on','for','with','at','by','from','is','are','was','were','be','been','being','i','you','he','she','they','we','me','my','your','our','their','this','that','these','those'
])

export type MemoryCategory = 'identity' | 'preference' | 'life_event' | 'relationship' | 'inside_joke' | 'routine' | 'mood' | 'topic'

export type StoredMemory = {
    id: string
    content: string
    similarity?: number
    created_at?: string
    importance?: number
    tags?: string[] | null
    category?: MemoryCategory | null
    last_used_at?: string | null
    expires_at?: string | null
}

export async function generateEmbedding(text: string) {
    const { embedding } = await embed({
        model: embeddingModel,
        value: text,
    })
    return embedding
}


export async function storeMemory(
    userId: string,
    content: string,
    options?: {
        kind?: 'episodic' | 'profile'
        tags?: string[]
        importance?: number
        useEmbedding?: boolean
        category?: MemoryCategory
        expires_at?: string | null
    }
) {
    try {
        const supabase = await createClient()
        const { kind = 'episodic', tags = [], importance = 1, useEmbedding = true, category, expires_at } = options || {}
        const normalizedContent = content.trim().replace(/\s+/g, ' ')
        const embedding = useEmbedding ? await generateEmbedding(normalizedContent) : null

        const { data: existing } = await supabase
            .from('memories')
            .select('id, content, created_at')
            .eq('user_id', userId)
            .eq('kind', kind)
            .order('created_at', { ascending: false })
            .limit(5)

        const duplicate = existing?.find((m) => {
            if (!m?.content) return false
            const recent = m.created_at ? (Date.now() - new Date(m.created_at).getTime()) < 10 * 60 * 1000 : false
            return recent && m.content.trim().replace(/\s+/g, ' ') === normalizedContent
        })

        if (duplicate) {
            return
        }

        // LOW-23: Memory conflict resolution — only archive near-exact duplicates in the same category
        if (importance >= 2 && category) {
            try {
                const { data: sameCategory } = await supabase
                    .from('memories')
                    .select('id, content')
                    .eq('user_id', userId)
                    .eq('kind', kind)
                    .eq('category', category)
                    .neq('kind', 'archived')
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (sameCategory && sameCategory.length > 0) {
                    const newWords = new Set(normalizedContent.toLowerCase().split(/\s+/).filter(w => w.length > 2))
                    const toArchive = sameCategory.filter(m => {
                        if (!m.content) return false
                        const existingNorm = m.content.trim().replace(/\s+/g, ' ')
                        // Exact duplicate
                        if (existingNorm === normalizedContent) return true
                        // High word overlap (3+ shared meaningful words)
                        const existingWords = existingNorm.toLowerCase().split(/\s+/).filter(w => w.length > 2)
                        const shared = existingWords.filter(w => newWords.has(w)).length
                        return shared >= 3 && shared >= existingWords.length * 0.5
                    })

                    if (toArchive.length > 0) {
                        await supabase
                            .from('memories')
                            .update({ kind: 'archived' })
                            .eq('user_id', userId)
                            .in('id', toArchive.map(m => m.id))
                    }
                }
            } catch (conflictErr) {
                console.error('Memory conflict resolution error:', conflictErr)
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertData: any = {
            user_id: userId,
            content: normalizedContent,
            embedding: embedding as unknown as string,
            kind,
            tags,
            importance,
        }
        if (category) insertData.category = category
        if (expires_at) insertData.expires_at = expires_at

        const { error } = await supabase.from('memories').insert(insertData)

        if (error) console.error('Error storing memory:', error)
    } catch (err) {
        console.error('Error generating or storing memory:', err)
    }
}

/** CRIT-4: Batch store memories with a single duplicate check query */
export async function storeMemories(
    userId: string,
    memories: Array<{
        content: string
        kind?: 'episodic' | 'profile'
        tags?: string[]
        importance?: number
        category?: MemoryCategory
        expires_at?: string | null
    }>,
    tier: SubscriptionTier = 'basic'
) {
    if (!memories.length) return
    try {
        const supabase = await createClient()

        // Normalize all incoming memory contents
        const normalized = memories.map(m => ({
            ...m,
            normalizedContent: m.content.trim().replace(/\s+/g, ' '),
            kind: m.kind || 'episodic',
        }))

        // P-I9: Single query for both duplicate check AND conflict resolution
        const { data: existingRaw } = await supabase
            .from('memories')
            .select('id, content, created_at, kind, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        const existing = (existingRaw || []) as unknown as Array<{ id: string; content: string; created_at: string; kind: string; category: string | null }>

        const existingNormalized = existing.map(m => ({
            id: m.id,
            content: m.content?.trim().replace(/\s+/g, ' ') || '',
            recent: m.created_at ? (Date.now() - new Date(m.created_at).getTime()) < 10 * 60 * 1000 : false,
            kind: m.kind,
            category: m.category,
        }))

        // Filter out duplicates (exact match within 10min OR high content similarity anytime)
        const nonDuplicates = normalized.filter(mem => {
            // Exact recent duplicate
            if (existingNormalized.some(ex =>
                ex.recent && ex.kind === mem.kind && ex.content === mem.normalizedContent
            )) return false
            // Near-duplicate anytime: same category + high word overlap
            if (mem.category && existingNormalized.some(ex => {
                if (ex.kind === 'archived' || ex.category !== mem.category) return false
                const newWords = new Set(mem.normalizedContent.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2))
                const exWords = ex.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
                if (exWords.length === 0) return false
                const shared = exWords.filter((w: string) => newWords.has(w)).length
                return shared >= 2 && shared >= exWords.length * 0.6
            })) return false
            return true
        })

        if (!nonDuplicates.length) return

        // LOW-23: Batch conflict resolution from the same result set (no extra query)
        const highImportanceWithCategory = nonDuplicates.filter(m => (m.importance ?? 1) >= 2 && m.category)
        if (highImportanceWithCategory.length > 0) {
            try {
                // Use existing rows that are not archived for conflict resolution
                const nonArchivedWithCategory = existingNormalized.filter(m => m.kind !== 'archived' && m.category)

                if (nonArchivedWithCategory.length > 0) {
                    const toArchiveIds: string[] = []
                    for (const newMem of highImportanceWithCategory) {
                        const newWords = new Set(newMem.normalizedContent.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2))
                        for (const ex of nonArchivedWithCategory) {
                            if (!ex.content || ex.category !== newMem.category) continue
                            if (toArchiveIds.includes(ex.id)) continue
                            // Exact duplicate
                            if (ex.content === newMem.normalizedContent) {
                                toArchiveIds.push(ex.id)
                                continue
                            }
                            // High word overlap (2+ shared meaningful words)
                            const existingWords = ex.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
                            const shared = existingWords.filter((w: string) => newWords.has(w)).length
                            if (shared >= 2 && shared >= existingWords.length * 0.4) {
                                toArchiveIds.push(ex.id)
                            }
                        }
                    }

                    if (toArchiveIds.length > 0) {
                        await supabase
                            .from('memories')
                            .update({ kind: 'archived' })
                            .eq('user_id', userId)
                            .in('id', toArchiveIds)
                    }
                }
            } catch (conflictErr) {
                console.error('Batch memory conflict resolution error:', conflictErr)
            }
        }

        // M-C3: Enforce memory count limits — delete oldest if at/over limit
        // Only count non-expired memories toward quota so stale temporal memories
        // don't pressure stable facts into eviction.
        const memoryMaxCount = getMemoryMaxCount(tier)
        if (memoryMaxCount !== null) {
            const quotaNowIso = new Date().toISOString()
            const { count: currentCount } = await supabase
                .from('memories')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('kind', 'episodic')
                .or(`expires_at.is.null,expires_at.gt.${quotaNowIso}`)

            if (currentCount !== null && currentCount + nonDuplicates.length > memoryMaxCount) {
                const excess = (currentCount + nonDuplicates.length) - memoryMaxCount
                if (excess > 0) {
                    // Evict oldest non-expired memories (expired ones are already invisible)
                    const { data: oldest } = await supabase
                        .from('memories')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('kind', 'episodic')
                        .or(`expires_at.is.null,expires_at.gt.${quotaNowIso}`)
                        .order('created_at', { ascending: true })
                        .limit(excess)

                    if (oldest && oldest.length > 0) {
                        await supabase
                            .from('memories')
                            .delete()
                            .in('id', oldest.map(m => m.id))
                    }
                }
            }
        }

        // M-I2: Skip embedding generation for free tier (memoryInPromptLimit === 0)
        const skipEmbeddings = getMemoryInPromptLimit(tier) === 0

        // Generate embeddings in parallel (skip for free tier to save API costs)
        const withEmbeddings = await Promise.all(
            nonDuplicates.map(async (mem) => {
                let embedding: number[] | null = null
                if (!skipEmbeddings) {
                    try {
                        embedding = await generateEmbedding(mem.normalizedContent)
                    } catch (err) {
                        console.error('Embedding error for memory:', err)
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const row: any = {
                    user_id: userId,
                    content: mem.normalizedContent,
                    embedding: embedding as unknown as string,
                    kind: mem.kind,
                    tags: mem.tags || [],
                    importance: mem.importance || 1,
                }
                if (mem.category) row.category = mem.category
                if (mem.expires_at) row.expires_at = mem.expires_at
                return row
            })
        )

        // M-I3: Semantic deduplication — skip memories with >0.9 embedding similarity to recent ones
        let finalRows = withEmbeddings
        if (!skipEmbeddings) {
            const rowsWithEmbeddings = withEmbeddings.filter(r => r.embedding !== null)
            if (rowsWithEmbeddings.length > 0 && existing && existing.length > 0) {
                const semanticDupIds = new Set<number>()
                // PERF-I1: Parallel semantic dedup checks
                const checks = await Promise.all(
                    rowsWithEmbeddings.map(async (row) => {
                        try {
                            const { data: similar } = await supabase.rpc('match_memories', {
                                query_embedding: row.embedding,
                                match_threshold: 0.9,
                                match_count: 1,
                                p_user_id: userId,
                            })
                            return !!(similar && similar.length > 0)
                        } catch (err) {
                            console.error('Semantic dedup check error:', err)
                            return false
                        }
                    })
                )
                rowsWithEmbeddings.forEach((row, i) => {
                    if (checks[i]) {
                        const idx = withEmbeddings.indexOf(row)
                        if (idx >= 0) semanticDupIds.add(idx)
                    }
                })
                if (semanticDupIds.size > 0) {
                    finalRows = withEmbeddings.filter((_, i) => !semanticDupIds.has(i))
                }
            }
        }

        if (!finalRows.length) return

        const { error } = await supabase.from('memories').insert(finalRows)
        if (error) console.error('Error batch storing memories:', error)
    } catch (err) {
        console.error('Error in storeMemories batch:', err)
    }
}

export async function retrieveMemories(userId: string, query: string, limit = 5) {
    const supabase = await createClient()
    let embedding: number[] = []
    try {
        embedding = await generateEmbedding(query)
    } catch (err) {
        console.error('Error generating embedding:', err)
        return []
    }

    const { data: memories, error } = await supabase.rpc('match_memories', {
        query_embedding: embedding as unknown as string,
        match_threshold: 0.5,
        match_count: limit,
        p_user_id: userId,
    })

    if (error) {
        console.error('Error retrieving memories:', error)
        return []
    }

    return memories as StoredMemory[]
}

function tokenize(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(t => !STOPWORDS.has(t))
}

function scoreMemory(queryTokens: string[], memory: StoredMemory) {
    const memTokens = tokenize(memory.content)
    const overlap = queryTokens.filter(t => memTokens.includes(t)).length
    const importance = memory.importance || 1
    return overlap + Math.min(3, importance)
}

export async function retrieveMemoriesLite(userId: string, query: string, limit = 5) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('memories')
        .select('id, content, created_at, importance, tags')
        .eq('user_id', userId)
        .eq('kind', 'episodic')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

    if (error || !data) {
        if (error) console.error('Error retrieving memories:', error)
        return []
    }

    const queryTokens = tokenize(query)
    const scored = data.map((m) => ({
        ...m,
        similarity: scoreMemory(queryTokens, m as StoredMemory)
    }))

    scored.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    return scored.slice(0, limit) as StoredMemory[]
}

/** Validate and clamp expires_in_hours from LLM output. Returns valid hours or null. */
export function validateExpiresInHours(value: unknown): number | null {
    if (value == null) return null
    const n = Number(value)
    if (!Number.isFinite(n) || n < 1 || n > 720) return null
    return n
}

/** Pure scoring function — exported for testing */
export function computeCompositeScore(params: {
    similarity: number
    recency: number
    importance: number
    usageFrequency: number
    category: string | null
}): number {
    const importance = Math.min(3, params.importance)
    const categoryBoost = CATEGORY_PRIORITY[params.category || ''] ?? 0
    return 0.5 * params.similarity + 0.2 * params.recency + 0.15 * (importance / 3) + 0.15 * params.usageFrequency + categoryBoost
}

/** Hybrid retrieval: embedding similarity + recency, merged & ranked with category diversity */
export async function retrieveMemoriesHybrid(userId: string, query: string, limit = 5): Promise<StoredMemory[]> {
    const supabase = await createClient()

    // P-C2: Run embedding search and recency fetch in parallel
    const embeddingSearchPromise = (async (): Promise<StoredMemory[]> => {
        try {
            const embedding = await generateEmbedding(query)
            const { data, error } = await supabase.rpc('match_memories', {
                query_embedding: embedding as unknown as string,
                match_threshold: 0.5,
                match_count: 10,
                p_user_id: userId,
            })
            if (!error && data) {
                return data as StoredMemory[]
            } else if (error) {
                console.error('Hybrid retrieval embedding error:', error)
            }
        } catch (err) {
            console.error('Hybrid retrieval embedding generation error:', err)
        }
        return []
    })()

    const recentQueryPromise = supabase
        .from('memories')
        .select('id, content, created_at, importance, tags, last_used_at, category')
        .eq('user_id', userId)
        .eq('kind', 'episodic')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(5)

    const [embeddingResults, { data: recentData, error: recentError }] = await Promise.all([
        embeddingSearchPromise,
        recentQueryPromise,
    ])

    if (recentError) {
        console.error('Hybrid retrieval recency error:', recentError)
    }
    const recentResults: StoredMemory[] = (recentData || []) as unknown as StoredMemory[]

    // 3. Merge and deduplicate
    const mergedMap = new Map<string, StoredMemory & { _similarity: number; _recency: number }>()
    const now = Date.now()

    for (const mem of embeddingResults) {
        mergedMap.set(mem.id, {
            ...mem,
            _similarity: mem.similarity ?? 0,
            _recency: mem.created_at ? Math.max(0, 1 - (now - new Date(mem.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0,
        })
    }

    for (const mem of recentResults) {
        if (!mergedMap.has(mem.id)) {
            mergedMap.set(mem.id, {
                ...mem,
                _similarity: 0,
                _recency: mem.created_at ? Math.max(0, 1 - (now - new Date(mem.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0,
            })
        }
    }

    // 4. Rank by composite score: base formula preserved, category priority added as tiebreaker
    const scored = Array.from(mergedMap.values()).map(mem => {
        const lastUsed = mem.last_used_at ? new Date(mem.last_used_at).getTime() : 0
        const usageFrequency = lastUsed ? Math.max(0, 1 - (now - lastUsed) / (14 * 24 * 60 * 60 * 1000)) : 0

        const compositeScore = computeCompositeScore({
            similarity: mem._similarity,
            recency: mem._recency,
            importance: mem.importance ?? 1,
            usageFrequency,
            category: mem.category || null,
        })
        return { ...mem, compositeScore }
    })

    scored.sort((a, b) => b.compositeScore - a.compositeScore)

    // 5. Return top N with category diversity
    const result: StoredMemory[] = []
    const categorySeen = new Map<string, number>()
    const maxPerCategory = 2

    for (const mem of scored) {
        if (result.length >= limit) break
        const cat = mem.category || 'uncategorized'
        const catCount = categorySeen.get(cat) || 0
        if (catCount >= maxPerCategory && scored.length > limit) continue
        categorySeen.set(cat, catCount + 1)
        result.push({
            id: mem.id,
            content: mem.content,
            similarity: mem.compositeScore,
            created_at: mem.created_at,
            importance: mem.importance,
            tags: mem.tags,
            category: mem.category,
            last_used_at: mem.last_used_at,
        })
    }

    // If diversity filter was too aggressive, fill remaining slots
    if (result.length < limit) {
        for (const mem of scored) {
            if (result.length >= limit) break
            if (result.some(r => r.id === mem.id)) continue
            result.push({
                id: mem.id,
                content: mem.content,
                similarity: mem.compositeScore,
                created_at: mem.created_at,
                importance: mem.importance,
                tags: mem.tags,
                category: mem.category,
                last_used_at: mem.last_used_at,
            })
        }
    }

    return result
}

export async function touchMemories(memoryIds: string[]) {
    if (memoryIds.length === 0) return
    const supabase = await createClient()
    const { error } = await supabase
        .from('memories')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', memoryIds)

    if (error) console.error('Error updating memory last_used_at:', error)
}

const COMPACTION_THRESHOLD = 25

const TIER_COMPACTION_MAX_CHARS: Record<string, number> = {
    basic: 1000,
    pro: 2000,
}

export async function compactMemoriesIfNeeded(userId: string, tier: SubscriptionTier = 'basic') {
    try {
        const supabase = await createClient()

        // I1: Reset any rows stuck in 'compacting' state from a previous crashed run
        await supabase
            .from('memories')
            .update({ kind: 'episodic' })
            .eq('user_id', userId)
            .eq('kind', 'compacting')

        // Count active non-expired episodic memories
        const nowIso = new Date().toISOString()
        const { count, error: countError } = await supabase
            .from('memories')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('kind', 'episodic')
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

        if (countError || count === null || count < COMPACTION_THRESHOLD) return

        // Atomically claim non-expired episodic memories by marking them as 'compacting'.
        // Expired temporal memories are excluded — compacting them would resurrect temporary
        // states (mood, plans) as permanent compacted summaries.
        // Note: category column may not exist in generated types — use type assertion
        type ClaimedMemory = { id: string; content: string; importance: number; tags: string[]; created_at: string; category: string | null }
        const { data: claimedRaw, error: claimError } = await supabase
            .from('memories')
            .update({ kind: 'compacting' })
            .eq('user_id', userId)
            .eq('kind', 'episodic')
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .select('id, content, importance, tags, created_at, category')

        const claimed = (claimedRaw || []) as unknown as ClaimedMemory[]

        if (claimError || claimed.length < COMPACTION_THRESHOLD) {
            // Another request won the lock or not enough memories — revert any we claimed
            if (claimed.length > 0) {
                await supabase
                    .from('memories')
                    .update({ kind: 'episodic' })
                    .in('id', claimed.map((m) => m.id))
                    .eq('user_id', userId)
            }
            return
        }

        const memories = claimed
        const memoryIds = memories.map((m) => m.id)
        const maxCompactedChars = TIER_COMPACTION_MAX_CHARS[tier] || TIER_COMPACTION_MAX_CHARS.basic!

        try {
            // M-I1: Category-aware compaction — group memories by category, compact each separately
            const categoryGroups = new Map<string, ClaimedMemory[]>()
            for (const mem of memories) {
                const cat = mem.category || 'uncategorized'
                const group = categoryGroups.get(cat) || []
                group.push(mem)
                categoryGroups.set(cat, group)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const compactedInserts: any[] = []
            const archivedIds: string[] = []
            const skippedIds: string[] = [] // categories with <3 memories — revert to episodic

            for (const [category, groupMemories] of categoryGroups) {
                // Skip compacting categories with fewer than 3 memories
                if (groupMemories.length < 3) {
                    skippedIds.push(...groupMemories.map(m => m.id))
                    continue
                }

                const perCategoryMaxChars = Math.ceil(maxCompactedChars * (groupMemories.length / memories.length))
                const memoryList = groupMemories
                    .map((m, i) => `${i + 1}. ${m.content}`)
                    .join('\n')

                const { text: summary } = await generateText({
                    model: openRouterModel,
                    prompt: `You are a memory compaction assistant. Below are ${groupMemories.length} individual memory entries about a user in the "${category}" category. Summarize them into a concise paragraph (max ${perCategoryMaxChars} chars) that preserves all important personal facts, preferences, relationships, and key events. Drop redundant or trivial details. Output ONLY the summary, nothing else.\n\nMemories:\n${memoryList}`,
                    maxOutputTokens: Math.min(800, Math.ceil(perCategoryMaxChars / 2)),
                })

                const compactedContent = summary.trim().slice(0, perCategoryMaxChars)
                if (!compactedContent || compactedContent.length < 10) {
                    // Revert this group back to episodic
                    skippedIds.push(...groupMemories.map(m => m.id))
                    continue
                }

                // Collect tags from this group
                const groupTags = new Set<string>()
                groupMemories.forEach((m) => {
                    if (Array.isArray(m.tags)) m.tags.forEach((t: string) => groupTags.add(t))
                })

                // Generate embedding for the compacted summary
                let compactedEmbedding: number[] | null = null
                try {
                    compactedEmbedding = await generateEmbedding(compactedContent)
                } catch (embErr) {
                    console.error('Error generating compacted memory embedding:', embErr)
                }

                archivedIds.push(...groupMemories.map(m => m.id))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const insertRow: any = {
                    user_id: userId,
                    content: compactedContent,
                    embedding: compactedEmbedding as unknown as string,
                    kind: 'episodic',
                    tags: Array.from(groupTags).slice(0, 10),
                    importance: 3,
                }
                if (category !== 'uncategorized') insertRow.category = category
                compactedInserts.push(insertRow)
            }

            // Revert skipped memories back to episodic
            if (skippedIds.length > 0) {
                await supabase
                    .from('memories')
                    .update({ kind: 'episodic' })
                    .in('id', skippedIds)
                    .eq('user_id', userId)
            }

            // If no categories were compacted (all had <3), bail
            if (archivedIds.length === 0) return

            // Archive originals that were compacted
            const { error: archiveError } = await supabase
                .from('memories')
                .update({ kind: 'archived' })
                .in('id', archivedIds)
                .eq('user_id', userId)

            if (archiveError) {
                console.error('Error archiving memories:', archiveError)
                return
            }

            // Insert the compacted summaries
            if (compactedInserts.length > 0) {
                const { error: insertError } = await supabase.from('memories').insert(compactedInserts)
                if (insertError) {
                    console.error('Error inserting compacted memories:', insertError)
                }
            }

            // LOW-24: Delete archived memories older than 3 months
            try {
                const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
                await supabase
                    .from('memories')
                    .delete()
                    .eq('user_id', userId)
                    .eq('kind', 'archived')
                    .lt('created_at', threeMonthsAgo)
            } catch (cleanupErr) {
                console.error('Error cleaning up old archived memories:', cleanupErr)
            }
        } catch (compactionErr) {
            // Revert compacting back to episodic on any failure
            await supabase
                .from('memories')
                .update({ kind: 'episodic' })
                .in('id', memoryIds)
                .eq('user_id', userId)
            throw compactionErr
        }
    } catch (err) {
        console.error('Memory compaction error:', err)
    }
}

/**
 * Backfill embeddings for a user's existing memories that lack them.
 * Called on upgrade to paid tier so retrieval quality improves immediately.
 * Idempotent: only targets rows where embedding IS NULL.
 * Never throws — logs failures but does not break the caller.
 */
export async function backfillMemoryEmbeddings(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: { from: (...args: any[]) => any },
    batchSize = 50,
): Promise<{ processed: number; failed: number }> {
    try {
        const nowIso = new Date().toISOString()

        const { data: rows, error } = await supabase
            .from('memories')
            .select('id, content')
            .eq('user_id', userId)
            .eq('kind', 'episodic')
            .is('embedding', null)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order('created_at', { ascending: false })
            .limit(batchSize)

        if (error || !rows?.length) {
            if (error) console.error('[backfill] Query error:', error.message)
            return { processed: 0, failed: 0 }
        }

        let processed = 0
        let failed = 0

        for (const row of rows) {
            try {
                const embedding = await generateEmbedding(row.content)
                const { error: updateError } = await supabase
                    .from('memories')
                    .update({ embedding: embedding as unknown as string })
                    .eq('id', row.id)

                if (updateError) {
                    console.error(`[backfill] Update failed for memory ${row.id}:`, updateError.message)
                    failed++
                } else {
                    processed++
                }
            } catch (err) {
                console.error(`[backfill] Embedding failed for memory ${row.id}:`, err)
                failed++
            }
        }

        console.log(`[backfill] User ${userId}: ${processed} embeddings backfilled, ${failed} failed`)
        return { processed, failed }
    } catch (err) {
        console.error('[backfill] Unexpected error:', err)
        return { processed: 0, failed: 0 }
    }
}
