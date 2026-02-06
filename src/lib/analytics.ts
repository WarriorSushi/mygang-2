'use client'

const SESSION_IDLE_MS = 30 * 60 * 1000
const STORAGE_KEY = 'mygang_session_v1'

interface StoredSession {
    id: string
    startedAt: number
    lastActivityAt: number
}

const isStoredSession = (value: unknown): value is StoredSession => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return typeof record.id === 'string'
        && typeof record.startedAt === 'number'
        && typeof record.lastActivityAt === 'number'
}

export function ensureAnalyticsSession() {
    if (typeof window === 'undefined') {
        return { id: 'server', startedAt: Date.now(), isNew: false }
    }

    const now = Date.now()
    let stored: StoredSession | null = null

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as unknown
            stored = isStoredSession(parsed) ? parsed : null
        }
    } catch {
        stored = null
    }

    const shouldStartNew = !stored || (now - stored.lastActivityAt) > SESSION_IDLE_MS
    const session: StoredSession = shouldStartNew
        ? {
            id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`,
            startedAt: now,
            lastActivityAt: now
        }
        : {
            ...stored,
            lastActivityAt: now
        }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
        // Ignore storage errors.
    }

    return { id: session.id, startedAt: session.startedAt, isNew: shouldStartNew }
}

export async function trackEvent(event: string, options: { sessionId?: string; value?: number; metadata?: Record<string, unknown> } = {}) {
    if (typeof window === 'undefined') return

    const session = ensureAnalyticsSession()
    const payload = {
        event,
        session_id: options.sessionId || session.id,
        value: options.value,
        metadata: options.metadata
    }

    try {
        await fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
        })
    } catch {
        // Ignore analytics errors to avoid blocking UX.
    }
}
