import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getDodoClient, type SubscriptionTier } from '@/lib/billing'

const activateSchema = z.object({
    subscription_id: z.string().min(1).max(256),
})

type ActivationState = 'activated' | 'pending' | 'invalid'

function jsonResponse(
    status: number,
    payload: {
        state: ActivationState
        plan?: SubscriptionTier
        subscriptionStatus?: string | null
        reason?: string
    }
) {
    return Response.json(payload, { status })
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return jsonResponse(401, { state: 'invalid', reason: 'auth_required' })
    }

    const body = await req.json()
    const parsed = activateSchema.safeParse(body)
    if (!parsed.success) {
        return jsonResponse(400, { state: 'invalid', reason: 'invalid_subscription_id' })
    }
    const { subscription_id: subscriptionId } = parsed.data

    try {
        const dodo = getDodoClient()
        const subscription = await dodo.subscriptions.retrieve(subscriptionId) as unknown as Record<string, unknown>

        if (!subscription) {
            return jsonResponse(404, { state: 'invalid', reason: 'subscription_not_found' })
        }

        // C1: Always verify ownership — deny by default
        const subCustomerId = subscription.customer_id as string | undefined
        if (!subCustomerId) {
            return jsonResponse(400, { state: 'invalid', reason: 'missing_customer' })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        if (!profile?.dodo_customer_id || profile.dodo_customer_id !== subCustomerId) {
            return jsonResponse(403, { state: 'invalid', reason: 'customer_mismatch' })
        }

        // C9: Validate product ID — reject unknowns
        const productId = (subscription.product_id as string) || ''
        let plan: SubscriptionTier
        if (productId === process.env.DODO_PRODUCT_PRO) {
            plan = 'pro'
        } else if (productId === process.env.DODO_PRODUCT_BASIC) {
            plan = 'basic'
        } else {
            console.error(`[activate] Unknown product_id: ${productId}`)
            return jsonResponse(400, { state: 'invalid', reason: 'unknown_product' })
        }

        const status = String(subscription.status || '')
        if (status !== 'active' && status !== 'trialing') {
            return jsonResponse(200, {
                state: 'pending',
                plan,
                subscriptionStatus: status || null,
            })
        }

        // C8: Check for errors on DB writes
        const { error: tierError } = await supabase
            .from('profiles')
            .update({
                subscription_tier: plan,
                purchase_celebration_pending: plan,
            })
            .eq('id', user.id)

        if (tierError) {
            console.error('[activate] Tier update failed:', tierError)
            return jsonResponse(500, { state: 'invalid', reason: 'tier_update_failed' })
        }

        const { error: subError } = await supabase.from('subscriptions').upsert({
            id: subscriptionId,
            user_id: user.id,
            product_id: productId,
            plan,
            status,
            updated_at: new Date().toISOString(),
        })

        if (subError) {
            console.error('[activate] Subscription upsert failed:', subError)
            return jsonResponse(500, { state: 'invalid', reason: 'subscription_upsert_failed' })
        }

        return jsonResponse(200, {
            state: 'activated',
            plan,
            subscriptionStatus: status,
        })
    } catch (error) {
        console.error('[activate] Error:', error instanceof Error ? error.message : 'Unknown error')
        return jsonResponse(500, { state: 'invalid', reason: 'activation_failed' })
    }
}
