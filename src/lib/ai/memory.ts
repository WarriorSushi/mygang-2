import { google } from '@ai-sdk/google'
import { embed } from 'ai'
import { createClient } from '@/lib/supabase/server'

const embeddingModel = google.textEmbeddingModel('text-embedding-004')

export async function generateEmbedding(text: string) {
    const { embedding } = await embed({
        model: embeddingModel,
        value: text,
    })
    return embedding
}

export async function storeMemory(userId: string, content: string) {
    try {
        const supabase = await createClient()
        const embedding = await generateEmbedding(content)

        const { error } = await supabase.from('memories').insert({
            user_id: userId,
            content,
            embedding,
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

    // Use the match_memories RPC function (we need to define this in SQL)
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

    return memories as { content: string; similarity: number }[]
}
