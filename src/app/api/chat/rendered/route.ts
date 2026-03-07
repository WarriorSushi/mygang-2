import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeMessageId, isMissingHistoryMetadataColumnsError } from '@/lib/chat-utils'

const MAX_EVENT_CONTENT = 700

type ChatHistoryInsertRow = {
    user_id: string
    gang_id: string
    speaker: string
    content: string
    created_at: string
    client_message_id?: string | null
    reply_to_client_message_id?: string | null
    reaction?: string | null
}

type ChatHistoryExistingIdRow = {
    client_message_id: string | null
}

const renderedEventSchema = z.object({
    message_id: z.string().min(1).max(128),
    speaker: z.string().min(1).max(32),
    content: z.string().min(1).max(MAX_EVENT_CONTENT),
    displayed_at: z.string(),
    reaction: z.string().max(MAX_EVENT_CONTENT).optional().nullable(),
    reply_to_message_id: z.string().max(128).optional().nullable(),
})

const renderedSchema = z.object({
    turn_id: z.string().min(1).max(128),
    events: z.array(renderedEventSchema).min(1).max(20),
})

function toLegacyHistoryRows(rows: ChatHistoryInsertRow[]) {
    return rows.map((row) => ({
        user_id: row.user_id,
        gang_id: row.gang_id,
        speaker: row.speaker,
        content: row.content,
        created_at: row.created_at,
    }))
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rate = await rateLimit('chat-rendered:' + user.id, 30, 60_000)
    if (!rate.success) {
        return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const parsed = renderedSchema.safeParse(body)
    if (!parsed.success) {
        return Response.json({ error: 'Invalid rendered-event payload' }, { status: 400 })
    }

    const { events } = parsed.data

    const { data: gang, error: gangError } = await supabase
        .from('gangs')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })
        .select('id')
        .single()

    if (gangError || !gang?.id) {
        console.error('[chat/rendered] Failed to resolve gang:', gangError)
        return Response.json({ error: 'Could not persist rendered events' }, { status: 500 })
    }

    const rows: ChatHistoryInsertRow[] = []
    const seenIds = new Set<string>()

    for (const event of events) {
        const clientMessageId = sanitizeMessageId(event.message_id)
        if (!clientMessageId || seenIds.has(clientMessageId)) continue
        seenIds.add(clientMessageId)

        rows.push({
            user_id: user.id,
            gang_id: gang.id,
            speaker: event.speaker,
            content: event.content.trim().slice(0, MAX_EVENT_CONTENT),
            created_at: event.displayed_at,
            client_message_id: clientMessageId,
            reply_to_client_message_id: sanitizeMessageId(event.reply_to_message_id) || null,
            reaction: typeof event.reaction === 'string' && event.reaction.trim().length > 0
                ? event.reaction.trim().slice(0, MAX_EVENT_CONTENT)
                : null,
        })
    }

    if (rows.length === 0) {
        return Response.json({ ok: true, persisted: 0 })
    }

    const candidateIds = rows
        .map((row) => sanitizeMessageId(row.client_message_id))
        .filter(Boolean)

    let alreadyPersistedIds = new Set<string>()
    if (candidateIds.length > 0) {
        const existingIdsQuery = await supabase
            .from('chat_history')
            .select('client_message_id')
            .eq('user_id', user.id)
            .eq('gang_id', gang.id)
            .in('client_message_id', candidateIds)
            .returns<ChatHistoryExistingIdRow[]>()

        if (existingIdsQuery.error && !isMissingHistoryMetadataColumnsError(existingIdsQuery.error)) {
            console.error('[chat/rendered] Failed to query existing IDs:', existingIdsQuery.error)
            return Response.json({ error: 'Could not persist rendered events' }, { status: 500 })
        }

        if (!existingIdsQuery.error) {
            alreadyPersistedIds = new Set(
                (existingIdsQuery.data ?? [])
                    .map((row) => sanitizeMessageId(row.client_message_id))
                    .filter(Boolean)
            )
        }
    }

    const rowsToInsert = rows.filter((row) => {
        const rowClientMessageId = sanitizeMessageId(row.client_message_id)
        if (!rowClientMessageId) return false
        return !alreadyPersistedIds.has(rowClientMessageId)
    })

    if (rowsToInsert.length === 0) {
        return Response.json({ ok: true, persisted: 0 })
    }

    const insertWithMetadata = await supabase
        .from('chat_history')
        .insert(rowsToInsert)

    if (insertWithMetadata.error && isMissingHistoryMetadataColumnsError(insertWithMetadata.error)) {
        const insertLegacy = await supabase
            .from('chat_history')
            .insert(toLegacyHistoryRows(rowsToInsert))

        if (insertLegacy.error) {
            console.error('[chat/rendered] Failed legacy insert:', insertLegacy.error)
            return Response.json({ error: 'Could not persist rendered events' }, { status: 500 })
        }
    } else if (insertWithMetadata.error) {
        console.error('[chat/rendered] Failed insert:', insertWithMetadata.error)
        return Response.json({ error: 'Could not persist rendered events' }, { status: 500 })
    }

    return Response.json({ ok: true, persisted: rowsToInsert.length })
}
