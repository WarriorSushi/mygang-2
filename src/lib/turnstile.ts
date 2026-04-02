type TurnstileVerificationResponse = {
    success: boolean
    'error-codes'?: string[]
}

type VerifyTurnstileOptions = {
    remoteip?: string | null
}

function getTurnstileSecretKey() {
    return process.env.TURNSTILE_SECRET_KEY?.trim() || ''
}

export function isTurnstileServerEnabled() {
    return Boolean(getTurnstileSecretKey())
}

export async function verifyTurnstileToken(
    token: string,
    options: VerifyTurnstileOptions = {}
) {
    const secret = getTurnstileSecretKey()
    if (!secret) {
        return { ok: false as const, errorCode: 'missing-secret' }
    }

    const responseToken = token.trim()
    if (!responseToken) {
        return { ok: false as const, errorCode: 'missing-input-response' }
    }

    const body = new URLSearchParams({
        secret,
        response: responseToken,
    })

    if (options.remoteip && options.remoteip !== 'unknown') {
        body.set('remoteip', options.remoteip)
    }

    let payload: TurnstileVerificationResponse
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            cache: 'no-store',
        })

        if (!response.ok) {
            return { ok: false as const, errorCode: 'verification-request-failed' }
        }

        payload = await response.json() as TurnstileVerificationResponse
    } catch (error) {
        console.error('[turnstile] Verification request failed:', error)
        return { ok: false as const, errorCode: 'verification-request-failed' }
    }

    if (!payload.success) {
        return {
            ok: false as const,
            errorCode: payload['error-codes']?.[0] || 'verification-failed',
        }
    }

    return { ok: true as const }
}
