import { Webhooks } from '@dodopayments/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_LIMITS } from '@/lib/billing'

const supabase = createAdminClient()

async function findUserByCustomerId(customerId: string) {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('dodo_customer_id', customerId)
        .single()
    return data?.id ?? null
}

async function upsertSubscription(subscriptionId: string, userId: string, productId: string, plan: string, status: string, periodEnd?: string) {
    const { error } = await supabase.from('subscriptions').upsert({
        id: subscriptionId,
        user_id: userId,
        product_id: productId,
        plan,
        status,
        current_period_end: periodEnd ?? null,
        updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`upsertSubscription failed: ${error.message}`)
}

async function updateProfileTier(userId: string, tier: string) {
    const { error } = await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId)
    if (error) throw new Error(`updateProfileTier failed: ${error.message}`)
}

async function logBillingEvent(userId: string | null, eventType: string, dodoEventId: string | null, payload: Record<string, unknown>): Promise<boolean> {
    // C10: Idempotency check — skip if this event was already processed
    if (dodoEventId) {
        const { data: existing } = await supabase
            .from('billing_events')
            .select('id')
            .eq('dodo_event_id', dodoEventId)
            .maybeSingle()
        if (existing) {
            console.log(`[webhook] Skipping duplicate event: ${dodoEventId}`)
            return false
        }
    }

    const { error } = await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: eventType,
        dodo_event_id: dodoEventId,
        payload: payload as unknown as import('@/lib/database.types').Json,
    })
    if (error) throw new Error(`logBillingEvent failed: ${error.message}`)
    return true
}

function planFromProductId(productId: string): string | null {
    if (productId === process.env.DODO_PRODUCT_PRO) return 'pro'
    if (productId === process.env.DODO_PRODUCT_BASIC) return 'basic'
    return null
}

export const POST = Webhooks({
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

    onSubscriptionActive: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const productId = data.product_id as string
        const webhookId = data.webhook_id as string ?? null

        // C10: Idempotency
        const isNew = await logBillingEvent(null, 'subscription.active', webhookId, data)
        if (!isNew) return

        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] CRITICAL: No user found for customer_id=${customerId}, subscription_id=${subscriptionId}. User paid but activation was lost.`)
            await supabase.from('billing_events').insert({
                user_id: null,
                event_type: 'subscription.active.orphaned',
                dodo_event_id: null,
                payload: data as unknown as import('@/lib/database.types').Json,
            })
            return
        }

        // C9: Reject unknown products
        const plan = planFromProductId(productId)
        if (!plan) {
            console.error(`[webhook] Unknown product_id: ${productId}`)
            return
        }

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

                await supabase
                    .from('squad_tier_members')
                    .update({ is_active: true, deactivated_at: null })
                    .eq('user_id', userId)
                    .in('character_id', restoreIds)

                // I5: Use upsert to avoid duplicate key errors on squad restore
                const { data: gang } = await supabase
                    .from('gangs')
                    .select('id')
                    .eq('user_id', userId)
                    .single()
                if (gang) {
                    for (const id of restoreIds) {
                        await supabase.from('gang_members').upsert(
                            { gang_id: gang.id, character_id: id },
                            { onConflict: 'gang_id,character_id' }
                        )
                    }
                }

                const allIds = [...(currentGang?.map(g => g.character_id) ?? []), ...restoreIds]
                await supabase.from('profiles').update({
                    preferred_squad: allIds,
                    restored_members_pending: restoreIds,
                }).eq('id', userId)
            }
        }

        // Set celebration flag so AI friends congratulate user on next chat
        await supabase.from('profiles').update({ purchase_celebration_pending: true }).eq('id', userId)
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

        const { error } = await supabase.from('subscriptions').update({
            status: 'active',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Renewal update failed:', error)
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

        const { error } = await supabase.from('subscriptions').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Cancellation update failed:', error)
        await updateProfileTier(userId, 'free')
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

        const { error } = await supabase.from('subscriptions').update({
            status: 'expired',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Expiration update failed:', error)
        await updateProfileTier(userId, 'free')
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
