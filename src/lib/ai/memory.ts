import { google } from '@ai-sdk/google'
import { embed, generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { openRouterModel } from '@/lib/ai/openrouter'
import type { SubscriptionTier } from '@/lib/billing'

const embeddingModel = google.textEmbeddingModel('text-embedding-004')

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
    }
) {
    try {
        const supabase = await createClient()
        const { kind = 'episodic', tags = [], importance = 1, useEmbedding = true, category } = options || {}
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

        // LOW-23: Memory conflict resolution — archive older memories in the same category
        if (importance >= 2 && category) {
            try {
                const { data: conflicting } = await supabase
                    .from('memories')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('kind', kind)
                    .eq('category', category)
                    .neq('kind', 'archived')
                    .order('created_at', { ascending: false })
                    .limit(10)

                if (conflicting && conflicting.length > 0) {
                    await supabase
                        .from('memories')
                        .update({ kind: 'archived' })
                        .in('id', conflicting.map(m => m.id))
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
    }>
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

        // Single batch duplicate check: fetch recent memories for this user
        const { data: existing } = await supabase
            .from('memories')
            .select('id, content, created_at, kind')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30)

        const existingNormalized = (existing || []).map(m => ({
            content: m.content?.trim().replace(/\s+/g, ' ') || '',
            recent: m.created_at ? (Date.now() - new Date(m.created_at).getTime()) < 10 * 60 * 1000 : false,
            kind: m.kind,
        }))

        // Filter out duplicates
        const nonDuplicates = normalized.filter(mem => {
            return !existingNormalized.some(ex =>
                ex.recent && ex.kind === mem.kind && ex.content === mem.normalizedContent
            )
        })

        if (!nonDuplicates.length) return

        // LOW-23: Batch conflict resolution for high-importance memories with categories
        const highImportanceWithCategory = nonDuplicates.filter(m => (m.importance ?? 1) >= 2 && m.category)
        if (highImportanceWithCategory.length > 0) {
            const categories = [...new Set(highImportanceWithCategory.map(m => m.category!))]
            try {
                const { data: conflicting } = await supabase
                    .from('memories')
                    .select('id')
                    .eq('user_id', userId)
                    .neq('kind', 'archived')
                    .in('category', categories)
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (conflicting && conflicting.length > 0) {
                    await supabase
                        .from('memories')
                        .update({ kind: 'archived' })
                        .in('id', conflicting.map(m => m.id))
                }
            } catch (conflictErr) {
                console.error('Batch memory conflict resolution error:', conflictErr)
            }
        }

        // Generate embeddings in parallel
        const withEmbeddings = await Promise.all(
            nonDuplicates.map(async (mem) => {
                let embedding: number[] | null = null
                try {
                    embedding = await generateEmbedding(mem.normalizedContent)
                } catch (err) {
                    console.error('Embedding error for memory:', err)
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
                return row
            })
        )

        const { error } = await supabase.from('memories').insert(withEmbeddings)
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

/** Hybrid retrieval: embedding similarity + recency, merged & ranked with category diversity */
export async function retrieveMemoriesHybrid(userId: string, query: string, limit = 5): Promise<StoredMemory[]> {
    const supabase = await createClient()

    // 1. Embedding similarity search (top 10)
    let embeddingResults: StoredMemory[] = []
    try {
        const embedding = await generateEmbedding(query)
        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: embedding as unknown as string,
            match_threshold: 0.5,
            match_count: 10,
            p_user_id: userId,
        })
        if (!error && data) {
            embeddingResults = data as StoredMemory[]
        } else if (error) {
            console.error('Hybrid retrieval embedding error:', error)
        }
    } catch (err) {
        console.error('Hybrid retrieval embedding generation error:', err)
    }

    // 2. Recency fetch (5 most recent)
    // Note: category column may not exist in generated types yet, use type assertion
    const { data: recentData, error: recentError } = await supabase
        .from('memories')
        .select('id, content, created_at, importance, tags, last_used_at')
        .eq('user_id', userId)
        .eq('kind', 'episodic')
        .order('created_at', { ascending: false })
        .limit(5)

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

    // 4. Rank by composite score: 0.5*similarity + 0.2*recency + 0.15*importance/3 + 0.15*usage_frequency
    const scored = Array.from(mergedMap.values()).map(mem => {
        const importance = Math.min(3, mem.importance ?? 1)
        // usage_frequency: based on last_used_at, more recent use = higher frequency
        const lastUsed = mem.last_used_at ? new Date(mem.last_used_at).getTime() : 0
        const usageFrequency = lastUsed ? Math.max(0, 1 - (now - lastUsed) / (14 * 24 * 60 * 60 * 1000)) : 0

        const compositeScore = 0.5 * mem._similarity + 0.2 * mem._recency + 0.15 * (importance / 3) + 0.15 * usageFrequency
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

        // Count active episodic memories
        const { count, error: countError } = await supabase
            .from('memories')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('kind', 'episodic')

        if (countError || count === null || count < COMPACTION_THRESHOLD) return

        // Atomically claim episodic memories by marking them as 'compacting'.
        // If another request already changed them, this returns 0 rows and we bail.
        const { data: claimed, error: claimError } = await supabase
            .from('memories')
            .update({ kind: 'compacting' })
            .eq('user_id', userId)
            .eq('kind', 'episodic')
            .select('id, content, importance, tags, created_at')

        if (claimError || !claimed || claimed.length < COMPACTION_THRESHOLD) {
            // Another request won the lock or not enough memories — revert any we claimed
            if (claimed && claimed.length > 0) {
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
            // Build the memory list for LLM summarization
            const memoryList = memories
                .map((m, i) => `${i + 1}. ${m.content}`)
                .join('\n')

            const { text: summary } = await generateText({
                model: openRouterModel,
                prompt: `You are a memory compaction assistant. Below are ${memories.length} individual memory entries about a user. Summarize them into a concise paragraph (max ${maxCompactedChars} chars) that preserves all important personal facts, preferences, relationships, and key events. Drop redundant or trivial details. Output ONLY the summary, nothing else.\n\nMemories:\n${memoryList}`,
                maxOutputTokens: Math.min(800, Math.ceil(maxCompactedChars / 2)),
            })

            const compactedContent = summary.trim().slice(0, maxCompactedChars)
            if (!compactedContent || compactedContent.length < 10) {
                console.error('Memory compaction produced empty summary')
                // Revert compacting back to episodic
                await supabase
                    .from('memories')
                    .update({ kind: 'episodic' })
                    .in('id', memoryIds)
                    .eq('user_id', userId)
                return
            }

            // Collect all high-importance tags
            const allTags = new Set<string>()
            memories.forEach((m) => {
                if (Array.isArray(m.tags)) m.tags.forEach((t: string) => allTags.add(t))
            })

            // Generate embedding for the compacted summary
            let compactedEmbedding: number[] | null = null
            try {
                compactedEmbedding = await generateEmbedding(compactedContent)
            } catch (embErr) {
                console.error('Error generating compacted memory embedding:', embErr)
            }

            // Archive originals (they are currently 'compacting')
            const { error: archiveError } = await supabase
                .from('memories')
                .update({ kind: 'archived' })
                .in('id', memoryIds)
                .eq('user_id', userId)

            if (archiveError) {
                console.error('Error archiving memories:', archiveError)
                return
            }

            // Insert the compacted summary as a new episodic memory
            const { error: insertError } = await supabase.from('memories').insert({
                user_id: userId,
                content: compactedContent,
                embedding: compactedEmbedding as unknown as string,
                kind: 'episodic',
                tags: Array.from(allTags).slice(0, 10),
                importance: 3,
            })

            if (insertError) {
                console.error('Error inserting compacted memory:', insertError)
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
