import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getDodoClient } from '@/lib/billing'

const activateSchema = z.object({
    subscription_id: z.string().min(1).max(256),
})

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = activateSchema.safeParse(body)
    if (!parsed.success) {
        return Response.json({ error: 'Invalid or missing subscription_id' }, { status: 400 })
    }
    const { subscription_id: subscriptionId } = parsed.data

    try {
        const dodo = getDodoClient()
        const subscription = await dodo.subscriptions.retrieve(subscriptionId) as unknown as Record<string, unknown>

        if (!subscription) {
            return Response.json({ error: 'Subscription not found' }, { status: 404 })
        }

        // C2: Validate subscription status
        const status = subscription.status as string | undefined
        if (status !== 'active' && status !== 'trialing') {
            return Response.json({ error: 'Subscription is not active' }, { status: 403 })
        }

        // C1: Always verify ownership — deny by default
        const subCustomerId = subscription.customer_id as string | undefined
        if (!subCustomerId) {
            return Response.json({ error: 'Subscription has no customer' }, { status: 400 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        if (!profile?.dodo_customer_id || profile.dodo_customer_id !== subCustomerId) {
            return Response.json({ error: 'Subscription does not belong to this account' }, { status: 403 })
        }

        // C9: Validate product ID — reject unknowns
        const productId = (subscription.product_id as string) || ''
        let plan: string
        if (productId === process.env.DODO_PRODUCT_PRO) {
            plan = 'pro'
        } else if (productId === process.env.DODO_PRODUCT_BASIC) {
            plan = 'basic'
        } else {
            console.error(`[activate] Unknown product_id: ${productId}`)
            return Response.json({ error: 'Unknown product' }, { status: 400 })
        }

        // C8: Check for errors on DB writes
        const { error: tierError } = await supabase
            .from('profiles')
            .update({ subscription_tier: plan })
            .eq('id', user.id)

        if (tierError) {
            console.error('[activate] Tier update failed:', tierError)
            return Response.json({ error: 'Activation failed' }, { status: 500 })
        }

        const { error: subError } = await supabase.from('subscriptions').upsert({
            id: subscriptionId,
            user_id: user.id,
            product_id: productId,
            plan,
            status: 'active',
            updated_at: new Date().toISOString(),
        })

        if (subError) {
            console.error('[activate] Subscription upsert failed:', subError)
            return Response.json({ error: 'Activation failed' }, { status: 500 })
        }

        return Response.json({ success: true, plan })
    } catch (error) {
        console.error('[activate] Error:', error instanceof Error ? error.message : 'Unknown error')
        return Response.json({ error: 'Activation failed' }, { status: 500 })
    }
}
