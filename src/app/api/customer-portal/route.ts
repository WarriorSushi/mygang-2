import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { CustomerPortal } from '@dodopayments/nextjs'

// M2 FIX: Lazy init to avoid module-scope crash on missing env vars
let _portalHandler: ReturnType<typeof CustomerPortal> | null = null
function getPortalHandler() {
    if (!_portalHandler) {
        _portalHandler = CustomerPortal({
            bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
            environment: process.env.DODO_PAYMENTS_ENVIRONMENT as 'live_mode' | 'test_mode',
        })
    }
    return _portalHandler
}

export async function GET(req: NextRequest) {
    // Always require authentication — never trust client-supplied customer_id
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rate = await rateLimit('customer-portal:' + user.id, 10, 60_000)
    if (!rate.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('dodo_customer_id')
        .eq('id', user.id)
        .single()

    const customerId = profile?.dodo_customer_id
    if (!customerId) {
        return NextResponse.json({ error: 'No billing account found. Please contact support.' }, { status: 404 })
    }

    // Build request with the authenticated user's customer_id only
    const url = new URL(req.url)
    url.searchParams.set('customer_id', customerId)
    const newReq = new NextRequest(url, {
        method: req.method,
        headers: req.headers,
    })

    return getPortalHandler()(newReq)
}
