import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = await rateLimit(`push-sub:${user.id}`, 30, 60_000)
    if (!rate.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, created_at, updated_at')
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    return NextResponse.json({ subscriptions: data })
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate2 = await rateLimit(`push-sub:${user.id}`, 30, 60_000)
    if (!rate2.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    let body: { endpoint?: string; p256dh?: string; auth?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { endpoint, p256dh, auth } = body
    if (!endpoint || !p256dh || !auth) {
        return NextResponse.json({ error: 'Missing endpoint, p256dh, or auth' }, { status: 400 })
    }

    if (endpoint.length > 2048) {
        return NextResponse.json({ error: 'Endpoint too long' }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent') || null

    const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(
            {
                user_id: user.id,
                endpoint,
                p256dh,
                auth,
                user_agent: userAgent,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,endpoint' }
        )
        .select('id')
        .single()

    if (error) {
        console.error('Push subscription upsert error:', error)
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate3 = await rateLimit(`push-sub:${user.id}`, 30, 60_000)
    if (!rate3.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    let body: { endpoint?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { endpoint } = body
    if (!endpoint) {
        return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)

    if (error) {
        console.error('Push subscription delete error:', error)
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
