import { Webhooks } from '@dodopayments/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/database.types'
import { TIER_LIMITS } from '@/lib/billing'

const supabase = createAdminClient()

function getWebhookCustomerId(data: Record<string, unknown>) {
    if (typeof data.customer_id === 'string' && data.customer_id) return data.customer_id
    const nestedCustomer = data.customer
    if (nestedCustomer && typeof nestedCustomer === 'object') {
        const customerId = (nestedCustomer as Record<string, unknown>).customer_id
        if (typeof customerId === 'string' && customerId) return customerId
    }
    return null
}

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

async function updatePurchaseCelebration(userId: string, plan: 'basic' | 'pro') {
    const modernPayload = { purchase_celebration_pending: plan } satisfies Database['public']['Tables']['profiles']['Update']
    const { error } = await supabase.from('profiles').update(modernPayload).eq('id', userId)
    if (!error) return

    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    const needsLegacyBooleanFallback = message.includes('boolean') || message.includes('invalid input syntax')
    if (!needsLegacyBooleanFallback) {
        throw new Error(`updatePurchaseCelebration failed: ${error.message}`)
    }

    const legacyPayload = { purchase_celebration_pending: true } as unknown as Database['public']['Tables']['profiles']['Update']
    const { error: legacyError } = await supabase.from('profiles').update(legacyPayload).eq('id', userId)
    if (legacyError) throw new Error(`updatePurchaseCelebration legacy fallback failed: ${legacyError.message}`)
}

async function logBillingEvent(userId: string | null, eventType: string, dodoEventId: string | null, payload: Record<string, unknown>): Promise<boolean> {
    // MED-3: Use INSERT ON CONFLICT DO NOTHING to eliminate TOCTOU race condition.
    // If dodoEventId is provided, a unique constraint on dodo_event_id prevents duplicates atomically.
    if (dodoEventId) {
        // MED-3: Use INSERT ON CONFLICT to handle duplicate webhook events atomically
        const { error: insertError } = await supabase
            .from('billing_events')
            .insert({
                user_id: userId,
                event_type: eventType,
                dodo_event_id: dodoEventId,
                payload: payload as unknown as import('@/lib/database.types').Json,
            })
        if (insertError) {
            // Unique constraint violation means duplicate — not an error
            if (insertError.code === '23505') {
                console.log(`[webhook] Skipping duplicate event: ${dodoEventId}`)
                return false
            }
            throw new Error(`logBillingEvent failed: ${insertError.message}`)
        }
        return true
    }

    // No dodoEventId — just insert without idempotency check
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
        const customerId = getWebhookCustomerId(data)
        const subscriptionId = data.subscription_id as string
        const productId = data.product_id as string
        const webhookId = data.webhook_id as string ?? null

        if (!customerId) {
            console.error('[webhook] Missing customer_id on subscription.active payload')
            return
        }

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
                if (gang && restoreIds.length > 0) {
                    await supabase.from('gang_members').upsert(
                        restoreIds.map(id => ({ gang_id: gang.id, character_id: id })),
                        { onConflict: 'gang_id,character_id' }
                    )
                }

                const allIds = [...(currentGang?.map(g => g.character_id) ?? []), ...restoreIds]
                await supabase.from('profiles').update({
                    preferred_squad: allIds,
                    restored_members_pending: restoreIds,
                }).eq('id', userId)
            }
        }

        // Set celebration flag so AI friends congratulate user on next chat
        await updatePurchaseCelebration(userId, plan as 'basic' | 'pro')
    },

    onSubscriptionRenewed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = getWebhookCustomerId(data)
        const subscriptionId = data.subscription_id as string
        // MED-4: Extract webhook_id for idempotency (same pattern as onSubscriptionActive)
        const webhookId = data.webhook_id as string ?? null
        if (!customerId) {
            console.error('[webhook] Missing customer_id on subscription.renewed payload')
            return
        }
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on renewal, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.renewed.orphaned', webhookId, data)
            return
        }

        // MED-4: Check idempotency before processing
        const isNew = await logBillingEvent(userId, 'subscription.renewed', webhookId, data)
        if (!isNew) return

        const { error } = await supabase.from('subscriptions').update({
            status: 'active',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Renewal update failed:', error)
    },

    onSubscriptionCancelled: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = getWebhookCustomerId(data)
        const subscriptionId = data.subscription_id as string
        const webhookId = data.webhook_id as string ?? null
        if (!customerId) {
            console.error('[webhook] Missing customer_id on subscription.cancelled payload')
            return
        }
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on cancellation, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.cancelled.orphaned', webhookId, data)
            return
        }

        const isNew = await logBillingEvent(userId, 'subscription.cancelled', webhookId, data)
        if (!isNew) return

        const { error } = await supabase.from('subscriptions').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Cancellation update failed:', error)
        await updateProfileTier(userId, 'free')
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
    },

    onSubscriptionExpired: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = getWebhookCustomerId(data)
        const subscriptionId = data.subscription_id as string
        const webhookId = data.webhook_id as string ?? null
        if (!customerId) {
            console.error('[webhook] Missing customer_id on subscription.expired payload')
            return
        }
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on expiration, subscription_id=${subscriptionId}`)
            await logBillingEvent(null, 'subscription.expired.orphaned', webhookId, data)
            return
        }

        const isNew = await logBillingEvent(userId, 'subscription.expired', webhookId, data)
        if (!isNew) return

        const { error } = await supabase.from('subscriptions').update({
            status: 'expired',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Expiration update failed:', error)
        await updateProfileTier(userId, 'free')
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
    },

    onPaymentSucceeded: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const webhookId = data.webhook_id as string ?? null
        const customerId = getWebhookCustomerId(data)
        const userId = customerId ? await findUserByCustomerId(customerId) : null
        const isNew = await logBillingEvent(userId, 'payment.succeeded', webhookId, data)
        if (!isNew) return
    },

    onPaymentFailed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const webhookId = data.webhook_id as string ?? null
        const customerId = getWebhookCustomerId(data)
        const userId = customerId ? await findUserByCustomerId(customerId) : null
        const isNew = await logBillingEvent(userId, 'payment.failed', webhookId, data)
        if (!isNew) return
    },
})
