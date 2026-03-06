import { Webhooks } from '@dodopayments/nextjs'
import { createClient } from '@supabase/supabase-js'
import { TIER_LIMITS } from '@/lib/billing'

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

        // Restore previously removed squad members if slots available
        const newLimit = TIER_LIMITS[plan as keyof typeof TIER_LIMITS]?.squadLimit ?? 4
        const { data: currentGang } = await supabase
            .from('gang_members')
            .select('character_id, gangs!inner(user_id)')
            .eq('gangs.user_id', userId)
        const currentCount = currentGang?.length ?? 0
        const slotsAvailable = newLimit - currentCount

        if (slotsAvailable > 0) {
            const { data: restorable } = await supabase
                .from('squad_tier_members')
                .select('character_id')
                .eq('user_id', userId)
                .eq('is_active', false)
                .order('deactivated_at', { ascending: false })
                .limit(slotsAvailable)

            if (restorable?.length) {
                const restoreIds = restorable.map(r => r.character_id)

                // Re-activate in squad_tier_members
                await supabase
                    .from('squad_tier_members')
                    .update({ is_active: true, deactivated_at: null })
                    .eq('user_id', userId)
                    .in('character_id', restoreIds)

                // Add back to gang_members
                const { data: gang } = await supabase
                    .from('gangs')
                    .select('id')
                    .eq('user_id', userId)
                    .single()
                if (gang) {
                    await supabase.from('gang_members').insert(
                        restoreIds.map(id => ({ gang_id: gang.id, character_id: id }))
                    )
                }

                // Update preferred_squad and set welcome-back flag
                const allIds = [...(currentGang?.map(g => g.character_id) ?? []), ...restoreIds]
                await supabase.from('profiles').update({
                    preferred_squad: allIds,
                    restored_members_pending: restoreIds,
                }).eq('id', userId)
            }
        }

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
        // Flag for client to show downgrade keeper modal on next load
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
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
        // Flag for client to show downgrade keeper modal on next load
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
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
