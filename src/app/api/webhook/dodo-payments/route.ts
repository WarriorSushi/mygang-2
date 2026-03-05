import { Webhooks } from '@dodopayments/nextjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findUserByCustomerId(customerId: string) {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('dodo_customer_id', customerId)
        .single()
    return data?.id ?? null
}

async function upsertSubscription(subscriptionId: string, userId: string, productId: string, plan: string, status: string, periodEnd?: string) {
    await supabase.from('subscriptions').upsert({
        id: subscriptionId,
        user_id: userId,
        product_id: productId,
        plan,
        status,
        current_period_end: periodEnd ?? null,
        updated_at: new Date().toISOString(),
    })
}

async function updateProfileTier(userId: string, tier: string) {
    await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId)
}

async function logBillingEvent(userId: string | null, eventType: string, dodoEventId: string | null, payload: unknown) {
    await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: eventType,
        dodo_event_id: dodoEventId,
        payload,
    })
}

function planFromProductId(productId: string): string {
    if (productId === process.env.DODO_PRODUCT_PRO) return 'pro'
    if (productId === process.env.DODO_PRODUCT_BASIC) return 'basic'
    return 'basic' // default fallback
}

export const POST = Webhooks({
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

    onSubscriptionActive: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const productId = data.product_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] CRITICAL: No user found for customer_id=${customerId}, subscription_id=${subscriptionId}. User paid but activation was lost.`)
            await logBillingEvent(null, 'subscription.active.orphaned', data.webhook_id as string ?? null, data)
            return
        }

        const plan = planFromProductId(productId)
        await upsertSubscription(subscriptionId, userId, productId, plan, 'active')
        await updateProfileTier(userId, plan)
        // Set celebration flag so AI friends congratulate user on next chat
        await supabase.from('profiles').update({ purchase_celebration_pending: true }).eq('id', userId)
        await logBillingEvent(userId, 'subscription.active', data.webhook_id as string ?? null, data)
    },

    onSubscriptionRenewed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on renewal, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.renewed.orphaned', null, data)
            return
        }

        await supabase.from('subscriptions').update({
            status: 'active',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        await logBillingEvent(userId, 'subscription.renewed', null, data)
    },

    onSubscriptionCancelled: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on cancellation, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.cancelled.orphaned', null, data)
            return
        }

        await supabase.from('subscriptions').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        await updateProfileTier(userId, 'free')
        await logBillingEvent(userId, 'subscription.cancelled', null, data)
    },

    onSubscriptionExpired: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on expiration, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.expired.orphaned', null, data)
            return
        }

        await supabase.from('subscriptions').update({
            status: 'expired',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        await updateProfileTier(userId, 'free')
        await logBillingEvent(userId, 'subscription.expired', null, data)
    },

    onPaymentSucceeded: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const userId = await findUserByCustomerId(customerId)
        await logBillingEvent(userId, 'payment.succeeded', null, data)
    },

    onPaymentFailed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const userId = await findUserByCustomerId(customerId)
        await logBillingEvent(userId, 'payment.failed', null, data)
    },
})
