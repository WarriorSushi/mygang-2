import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const requestSchema = z.object({
    event: z.string().min(1).max(64),
    session_id: z.string().min(8).max(128),
    value: z.number().int().optional(),
    metadata: z.record(z.unknown()).optional()
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) {
            return Response.json({ ok: false }, { status: 400 })
        }

        const metadata = parsed.data.metadata || null
        if (metadata) {
            const size = JSON.stringify(metadata).length
            if (size > 2000) {
                return Response.json({ ok: false }, { status: 413 })
            }
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('analytics_events')
            .insert({
                user_id: user?.id ?? null,
                session_id: parsed.data.session_id,
                event: parsed.data.event,
                value: parsed.data.value ?? null,
                metadata
            })

        if (error) {
            if (error.code === 'PGRST205') {
                return Response.json({ ok: true })
            }
            console.error('Analytics insert error:', error)
            return Response.json({ ok: false }, { status: 500 })
        }

        return Response.json({ ok: true })
    } catch (err) {
        console.error('Analytics route error:', err)
        return Response.json({ ok: false }, { status: 500 })
    }
}
