import { google } from '@ai-sdk/google'
import { embed, generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { openRouterModel } from '@/lib/ai/openrouter'

const embeddingModel = google.textEmbeddingModel('text-embedding-004')

const STOPWORDS = new Set([
    'the','a','an','and','or','but','if','then','else','when','to','of','in','on','for','with','at','by','from','is','are','was','were','be','been','being','i','you','he','she','they','we','me','my','your','our','their','this','that','these','those'
])

export type StoredMemory = {
    id: string
    content: string
    similarity?: number
    created_at?: string
    importance?: number
    tags?: string[] | null
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
    }
) {
    try {
        const supabase = await createClient()
        const { kind = 'episodic', tags = [], importance = 1, useEmbedding = false } = options || {}
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

        const { error } = await supabase.from('memories').insert({
            user_id: userId,
            content: normalizedContent,
            embedding: embedding as unknown as string,
            kind,
            tags,
            importance,
        })

        if (error) console.error('Error storing memory:', error)
    } catch (err) {
        console.error('Error generating or storing memory:', err)
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

export async function touchMemories(memoryIds: string[]) {
    if (memoryIds.length === 0) return
    const supabase = await createClient()
    const { error } = await supabase
        .from('memories')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', memoryIds)

    if (error) console.error('Error updating memory last_used_at:', error)
}

const COMPACTION_THRESHOLD = 10

export async function compactMemoriesIfNeeded(userId: string) {
    try {
        const supabase = await createClient()

        // Count active episodic memories
        const { count, error: countError } = await supabase
            .from('memories')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('kind', 'episodic')

        if (countError || count === null || count < COMPACTION_THRESHOLD) return

        // Fetch all episodic memories to compact
        const { data: memories, error: fetchError } = await supabase
            .from('memories')
            .select('id, content, importance, tags, created_at')
            .eq('user_id', userId)
            .eq('kind', 'episodic')
            .order('created_at', { ascending: true })

        if (fetchError || !memories || memories.length < COMPACTION_THRESHOLD) return

        // Build the memory list for LLM summarization
        const memoryList = memories
            .map((m, i) => `${i + 1}. ${m.content}`)
            .join('\n')

        const { text: summary } = await generateText({
            model: openRouterModel,
            prompt: `You are a memory compaction assistant. Below are ${memories.length} individual memory entries about a user. Summarize them into a single concise paragraph (max 400 chars) that preserves all important personal facts, preferences, relationships, and key events. Drop redundant or trivial details. Output ONLY the summary, nothing else.\n\nMemories:\n${memoryList}`,
            maxOutputTokens: 200,
        })

        const compactedContent = summary.trim().slice(0, 500)
        if (!compactedContent || compactedContent.length < 10) {
            console.error('Memory compaction produced empty summary')
            return
        }

        // Collect all high-importance tags
        const allTags = new Set<string>()
        memories.forEach((m) => {
            if (Array.isArray(m.tags)) m.tags.forEach((t: string) => allTags.add(t))
        })

        // Archive originals (change kind from 'episodic' to 'archived')
        const memoryIds = memories.map((m) => m.id)
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
            kind: 'episodic',
            tags: Array.from(allTags).slice(0, 10),
            importance: 3,
        })

        if (insertError) {
            console.error('Error inserting compacted memory:', insertError)
        }
    } catch (err) {
        console.error('Memory compaction error:', err)
    }
}
