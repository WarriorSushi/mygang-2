/**
 * Phase 07C: Server-side push notification sender.
 *
 * Uses web-push to send notifications to stored push subscriptions.
 * Detects stale subscriptions (410/404) and removes them from DB.
 */

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ──

export type PushPayload = {
    title: string
    body: string
    url: string
}

export type SendResult = {
    endpoint: string
    ok: boolean
    stale: boolean
    statusCode?: number
}

// ── VAPID initialization ──

let vapidInitialized = false

function ensureVapid() {
    if (vapidInitialized) return
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT
    if (!publicKey || !privateKey || !subject) {
        throw new Error('[push] Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)')
    }
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidInitialized = true
}

// ── Pure helpers (exported for testing) ──

/** HTTP status codes that indicate a permanently dead subscription. */
export function isStaleStatus(statusCode: number): boolean {
    return statusCode === 404 || statusCode === 410
}

/** Build a small JSON payload string for the push message. */
export function buildPushPayload(payload: PushPayload): string {
    return JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
    })
}

// ── Send helpers ──

/**
 * Send a push notification to a single subscription.
 * Returns result with stale flag for cleanup decisions.
 */
export async function sendToOne(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
): Promise<SendResult> {
    ensureVapid()

    const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
        },
    }

    try {
        await webpush.sendNotification(pushSubscription, buildPushPayload(payload))
        return { endpoint: subscription.endpoint, ok: true, stale: false }
    } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 0
        return {
            endpoint: subscription.endpoint,
            ok: false,
            stale: isStaleStatus(statusCode),
            statusCode,
        }
    }
}

/**
 * Send a push notification to all subscriptions for a user.
 * Removes stale subscriptions from DB after sending.
 * Transient failures are logged and skipped.
 */
export async function sendToUser(
    userId: string,
    payload: PushPayload,
): Promise<{ sent: number; failed: number; staleRemoved: number }> {
    const admin = createAdminClient()

    const { data: subs, error } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)

    if (error || !subs || subs.length === 0) {
        return { sent: 0, failed: 0, staleRemoved: 0 }
    }

    const results = await Promise.allSettled(
        subs.map(sub => sendToOne(sub, payload))
    )

    let sent = 0
    let failed = 0
    const staleEndpoints: string[] = []

    for (const result of results) {
        if (result.status === 'rejected') {
            failed++
            continue
        }
        const r = result.value
        if (r.ok) {
            sent++
        } else if (r.stale) {
            staleEndpoints.push(r.endpoint)
        } else {
            failed++
            console.error(`[push] Transient failure for ${r.endpoint}: status=${r.statusCode}`)
        }
    }

    // Clean up stale subscriptions
    let staleRemoved = 0
    if (staleEndpoints.length > 0) {
        const { error: deleteError } = await admin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .in('endpoint', staleEndpoints)

        if (deleteError) {
            console.error('[push] Failed to clean up stale subscriptions:', deleteError.message)
        } else {
            staleRemoved = staleEndpoints.length
            console.log(`[push] Removed ${staleRemoved} stale subscription(s) for user ${userId}`)
        }
    }

    return { sent, failed, staleRemoved }
}
