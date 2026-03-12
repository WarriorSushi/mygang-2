'use client'

import { trackEvent } from '@/lib/analytics'

type ErrorLike = {
    code?: unknown
    message?: unknown
}

export function getOperationalErrorCode(error: unknown) {
    if (!error || typeof error !== 'object') return null
    const maybeError = error as ErrorLike
    return typeof maybeError.code === 'string' ? maybeError.code : null
}

export function isSquadTierWriteError(error: unknown) {
    const code = getOperationalErrorCode(error)
    return typeof code === 'string' && code.startsWith('squad_tier_')
}

export function getOperationalErrorMetadata(error: unknown) {
    if (error instanceof Error) {
        return {
            error_code: getOperationalErrorCode(error) || 'unknown_error',
            error_message: error.message,
        }
    }

    if (typeof error === 'string') {
        return {
            error_code: 'unknown_error',
            error_message: error,
        }
    }

    return {
        error_code: 'unknown_error',
        error_message: 'Unknown error',
    }
}

export function trackOperationalEvent(event: string, metadata: Record<string, unknown>) {
    void trackEvent(event, { metadata })
}

export function trackOperationalError(event: string, metadata: Record<string, unknown>, error: unknown) {
    void trackEvent(event, {
        metadata: {
            ...metadata,
            outcome: 'error',
            ...getOperationalErrorMetadata(error),
        },
    })
}
