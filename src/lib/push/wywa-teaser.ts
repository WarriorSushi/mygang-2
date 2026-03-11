/**
 * Phase 07C: WYWA push teaser.
 *
 * Sends exactly one push notification per successful WYWA batch.
 * Fire-and-forget — callers should .catch() to prevent batch failures.
 */

import { sendToUser, type PushPayload } from './send'

const WYWA_TEASER_PAYLOAD: PushPayload = {
    title: 'MyGang',
    body: 'While you were away, your gang started talking.',
    url: '/chat',
}

/**
 * Send one teaser push to all of a user's devices.
 * If the user has no subscriptions, this is a no-op.
 */
export async function sendWywaTeaser(userId: string): Promise<void> {
    const result = await sendToUser(userId, WYWA_TEASER_PAYLOAD)

    if (result.sent > 0) {
        console.log(`[wywa-push] Sent teaser to ${result.sent} device(s) for user ${userId}`)
    }
    if (result.staleRemoved > 0) {
        console.log(`[wywa-push] Cleaned ${result.staleRemoved} stale sub(s) for user ${userId}`)
    }
}
