import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDodoClient } from '@/lib/billing'

const PRODUCT_IDS: Record<string, string> = {
    basic: process.env.DODO_PRODUCT_BASIC || '',
    pro: process.env.DODO_PRODUCT_PRO || '',
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const plan = body.plan as string

    if (!plan || !PRODUCT_IDS[plan]) {
        return Response.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const productId = PRODUCT_IDS[plan]
    if (!productId) {
        return Response.json({ error: 'Product not configured' }, { status: 500 })
    }

    try {
        const dodo = getDodoClient()

        // Ensure user has a dodo_customer_id, or create one
        const { data: profile } = await supabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        let customerId = profile?.dodo_customer_id

        if (!customerId) {
            const customer = await dodo.customers.create({
                email: user.email!,
                name: user.user_metadata?.full_name || user.email!,
            })
            customerId = customer.customer_id
            await supabase
                .from('profiles')
                .update({ dodo_customer_id: customerId })
                .eq('id', user.id)
        }

        const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL!

        const session = await dodo.checkoutSessions.create({
            product_cart: [{ product_id: productId, quantity: 1 }],
            customer: { customer_id: customerId },
            return_url: returnUrl,
        })

        return Response.json({ checkout_url: session.checkout_url })
    } catch (error) {
        console.error('[checkout] Error creating session:', error)
        return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
}
