import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDodoClient } from '@/lib/billing'

const checkoutSchema = z.object({
    plan: z.enum(['basic', 'pro']),
})

const PRODUCT_IDS: Record<string, string> = {
    basic: process.env.DODO_PRODUCT_BASIC || '',
    pro: process.env.DODO_PRODUCT_PRO || '',
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
        return Response.json({ error: 'Invalid plan' }, { status: 400 })
    }
    const { plan } = parsed.data

    const productId = PRODUCT_IDS[plan]
    if (!productId) {
        return Response.json({ error: 'Product not configured' }, { status: 500 })
    }

    try {
        const dodo = getDodoClient()

        // Ensure user has a dodo_customer_id, or create one
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        let customerId = profile?.dodo_customer_id

        if (!customerId) {
            // I4: Check for email before creating customer
            if (!user.email) {
                return Response.json({ error: 'Account has no email address' }, { status: 400 })
            }

            const customer = await dodo.customers.create({
                email: user.email,
                name: user.user_metadata?.full_name || user.email,
            })
            customerId = customer.customer_id

            // I3: Conditional update — only set if still null (prevents double-click race)
            const { data: updated, error: updateError } = await adminSupabase
                .from('profiles')
                .update({ dodo_customer_id: customerId })
                .eq('id', user.id)
                .is('dodo_customer_id', null)
                .select('dodo_customer_id')
                .maybeSingle()

            if (updateError) {
                console.error('[checkout] Failed to persist dodo_customer_id:', updateError)
                return Response.json({ error: 'Failed to prepare billing profile' }, { status: 500 })
            }

            // If another request already set it, use the existing one
            if (!updated?.dodo_customer_id) {
                const { data: existing, error: existingError } = await adminSupabase
                    .from('profiles')
                    .select('dodo_customer_id')
                    .eq('id', user.id)
                    .maybeSingle()

                if (existingError) {
                    console.error('[checkout] Failed to re-read dodo_customer_id:', existingError)
                    return Response.json({ error: 'Failed to prepare billing profile' }, { status: 500 })
                }

                if (!existing?.dodo_customer_id) {
                    console.error('[checkout] Missing dodo_customer_id after customer creation')
                    return Response.json({ error: 'Failed to prepare billing profile' }, { status: 500 })
                }

                customerId = existing.dodo_customer_id
            }
        }

        const returnUrl = new URL(process.env.DODO_PAYMENTS_RETURN_URL!)
        returnUrl.searchParams.set('plan', plan)

        const session = await dodo.checkoutSessions.create({
            product_cart: [{ product_id: productId, quantity: 1 }],
            customer: { customer_id: customerId },
            return_url: returnUrl.toString(),
        })

        return Response.json({ checkout_url: session.checkout_url })
    } catch (error) {
        console.error('[checkout] Error creating session:', error instanceof Error ? error.message : 'Unknown error')
        return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
}
