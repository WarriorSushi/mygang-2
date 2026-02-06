import { google } from '@ai-sdk/google'
import { embed } from 'ai'
import { createClient } from '@/lib/supabase/server'

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

export function shouldTriggerMemoryUpdate(text: string) {
    const lower = text.toLowerCase()
    const triggers = [
        'remember this',
        'don\'t forget',
        'my name is',
        'i am ',
        'i\'m ',
        'i work as',
        'i work at',
        'i live in',
        'my job',
        'my favorite',
        'i love ',
        'i hate ',
        'i like ',
        'my goal',
        'i want to',
    ]
    return triggers.some(t => lower.includes(t))
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
        const embedding = useEmbedding ? await generateEmbedding(content) : null

        const { error } = await supabase.from('memories').insert({
            user_id: userId,
            content,
            embedding,
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
        query_embedding: embedding,
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
