/**
 * Meta Pixel + Conversions API (CAPI) utilities.
 *
 * Server-side: sendCAPIEvent() — fires events to Meta's CAPI endpoint.
 * Client-side: pixel helpers are in components/meta-pixel.tsx.
 *
 * Dedup strategy: every event carries a shared event_id (UUID v4).
 * The Pixel fires it via eventID param; CAPI fires it via event_id.
 * Meta matches on (event_name, event_id) and deduplicates automatically.
 */

import { createHash, randomUUID } from 'crypto'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID!
const CAPI_TOKEN = process.env.META_CAPI_TOKEN!
const CAPI_URL = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`

// ---------------------------------------------------------------------------
// Hashing — Meta requires SHA-256 of lowercased/trimmed PII
// ---------------------------------------------------------------------------

export function hashPii(value: string): string {
    return createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

// ---------------------------------------------------------------------------
// Event ID — generate once per event, share between Pixel + CAPI
// ---------------------------------------------------------------------------

export function generateEventId(): string {
    return randomUUID()
}

// ---------------------------------------------------------------------------
// CAPI payload types
// ---------------------------------------------------------------------------

export type CAPIUserData = {
    em?: string       // hashed email
    ph?: string       // hashed phone
    client_ip_address?: string
    client_user_agent?: string
    fbc?: string      // _fbc cookie
    fbp?: string      // _fbp cookie
    external_id?: string  // hashed user id
}

export type CAPIEvent = {
    event_name: string
    event_time: number  // unix seconds
    event_id: string
    event_source_url?: string
    action_source: 'website'
    user_data: CAPIUserData
    custom_data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// sendCAPIEvent — fire one or more events to Meta's CAPI
// ---------------------------------------------------------------------------

export async function sendCAPIEvent(events: CAPIEvent[]): Promise<void> {
    if (!PIXEL_ID || !CAPI_TOKEN) {
        console.warn('[meta-capi] Missing PIXEL_ID or CAPI_TOKEN — skipping')
        return
    }

    const payload = {
        data: events,
        // test_event_code: 'TEST12345',  // uncomment for Meta test events
    }

    try {
        const res = await fetch(`${CAPI_URL}?access_token=${CAPI_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const text = await res.text()
            console.error('[meta-capi] CAPI error', res.status, text)
        }
    } catch (err) {
        // Non-fatal — never let analytics break the app
        console.error('[meta-capi] Failed to send event:', err)
    }
}

// ---------------------------------------------------------------------------
// Convenience builders
// ---------------------------------------------------------------------------

export function buildCompleteRegistrationEvent(opts: {
    eventId: string
    email: string
    ip: string
    userAgent: string
    sourceUrl?: string
    fbp?: string
    fbc?: string
}): CAPIEvent {
    return {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        event_source_url: opts.sourceUrl ?? 'https://mygang.ai',
        action_source: 'website',
        user_data: {
            em: hashPii(opts.email),
            client_ip_address: opts.ip,
            client_user_agent: opts.userAgent,
            ...(opts.fbp ? { fbp: opts.fbp } : {}),
            ...(opts.fbc ? { fbc: opts.fbc } : {}),
        },
    }
}

export function buildPurchaseEvent(opts: {
    eventId: string
    userId: string
    email: string
    plan: string
    value: number       // in USD
    currency: string
    ip: string
    userAgent: string
    sourceUrl?: string
    fbp?: string
    fbc?: string
}): CAPIEvent {
    return {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        event_source_url: opts.sourceUrl ?? 'https://mygang.ai/pricing',
        action_source: 'website',
        user_data: {
            em: hashPii(opts.email),
            external_id: hashPii(opts.userId),
            client_ip_address: opts.ip,
            client_user_agent: opts.userAgent,
            ...(opts.fbp ? { fbp: opts.fbp } : {}),
            ...(opts.fbc ? { fbc: opts.fbc } : {}),
        },
        custom_data: {
            value: opts.value,
            currency: opts.currency,
            content_name: opts.plan,
            content_type: 'subscription',
        },
    }
}
