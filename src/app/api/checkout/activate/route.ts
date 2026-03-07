import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import type { Database } from '@/lib/database.types'
import { getDodoClient } from '@/lib/billing-server'
import type { SubscriptionTier } from '@/lib/billing'

const activateSchema = z.object({
    subscription_id: z.string().min(1).max(256),
})

type ActivationState = 'activated' | 'pending' | 'invalid'
type DodoCustomerRecord = {
    customer_id?: string
    email?: string | null
}
type DodoSubscriptionRecord = Record<string, unknown> & {
    customer?: DodoCustomerRecord | null
}

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

function getSubscriptionCustomer(subscription: DodoSubscriptionRecord) {
    const nestedCustomer = subscription.customer ?? null
    const customerId = typeof subscription.customer_id === 'string' && subscription.customer_id
        ? subscription.customer_id
        : typeof nestedCustomer?.customer_id === 'string' && nestedCustomer.customer_id
            ? nestedCustomer.customer_id
            : null
    const customerEmail = typeof nestedCustomer?.email === 'string' && nestedCustomer.email
        ? nestedCustomer.email.trim().toLowerCase()
        : null

    return { customerId, customerEmail }
}

async function updateProfileSubscriptionState(
    adminSupabase: ReturnType<typeof createAdminClient>,
    userId: string,
    plan: SubscriptionTier
) {
    const modernPayload = {
        subscription_tier: plan,
        purchase_celebration_pending: plan,
    } satisfies Database['public']['Tables']['profiles']['Update']

    const { error } = await adminSupabase
        .from('profiles')
        .update(modernPayload)
        .eq('id', userId)

    if (!error) return null

    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    const needsLegacyBooleanFallback = message.includes('boolean') || message.includes('invalid input syntax')
    if (!needsLegacyBooleanFallback) return error

    const legacyPayload = {
        subscription_tier: plan,
        purchase_celebration_pending: true,
    } as unknown as Database['public']['Tables']['profiles']['Update']

    const { error: legacyError } = await adminSupabase
        .from('profiles')
        .update(legacyPayload)
        .eq('id', userId)

    return legacyError ?? null
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return jsonResponse(401, { state: 'invalid', reason: 'auth_required' })
    }

    const rate = await rateLimit('checkout-activate:' + user.id, 20, 60_000)
    if (!rate.success) {
        return jsonResponse(429, { state: 'invalid', reason: 'rate_limited' })
    }

    let body: unknown
    try { body = await req.json() } catch { return jsonResponse(400, { state: 'invalid', reason: 'malformed_json' }) }
    const parsed = activateSchema.safeParse(body)
    if (!parsed.success) {
        return jsonResponse(400, { state: 'invalid', reason: 'invalid_subscription_id' })
    }
    const { subscription_id: subscriptionId } = parsed.data

    try {
        const dodo = getDodoClient()
        const subscription = await dodo.subscriptions.retrieve(subscriptionId) as unknown as DodoSubscriptionRecord

        if (!subscription) {
            return jsonResponse(404, { state: 'invalid', reason: 'subscription_not_found' })
        }

        const { customerId: subCustomerId, customerEmail: subCustomerEmail } = getSubscriptionCustomer(subscription)
        if (!subCustomerId) {
            return jsonResponse(400, { state: 'invalid', reason: 'missing_customer' })
        }

        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        if (profileError) {
            console.error('[activate] Failed to load profile:', profileError)
            return jsonResponse(500, { state: 'invalid', reason: 'profile_lookup_failed' })
        }

        let persistedCustomerId = profile?.dodo_customer_id ?? null
        if (!persistedCustomerId) {
            const normalizedUserEmail = user.email?.trim().toLowerCase() ?? null
            if (!normalizedUserEmail || !subCustomerEmail || normalizedUserEmail !== subCustomerEmail) {
                return jsonResponse(403, { state: 'invalid', reason: 'customer_mismatch' })
            }

            const { error: backfillError } = await adminSupabase
                .from('profiles')
                .update({ dodo_customer_id: subCustomerId })
                .eq('id', user.id)

            if (backfillError) {
                console.error('[activate] Failed to backfill dodo_customer_id:', backfillError)
                return jsonResponse(500, { state: 'invalid', reason: 'customer_backfill_failed' })
            }

            persistedCustomerId = subCustomerId
        }

        if (persistedCustomerId !== subCustomerId) {
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
        const tierError = await updateProfileSubscriptionState(adminSupabase, user.id, plan)
        if (tierError) {
            console.error('[activate] Tier update failed:', tierError)
            return jsonResponse(500, { state: 'invalid', reason: 'tier_update_failed' })
        }

        const { error: subError } = await adminSupabase.from('subscriptions').upsert({
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
