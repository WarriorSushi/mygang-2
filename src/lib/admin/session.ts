import crypto from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const ADMIN_SESSION_COOKIE = 'mygang_admin_session'
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12
const ADMIN_SESSION_REDIS_PREFIX = 'admin_session:'

type AdminSessionPayload = {
    email: string
    sid: string
    exp: number
}

// Lazy Redis getter — doesn't crash if Redis is unavailable
let _redis: Awaited<ReturnType<typeof import('@upstash/redis')['Redis']['fromEnv']>> | null = null
let _redisInitAttempted = false

async function getRedis() {
    if (_redisInitAttempted) return _redis
    _redisInitAttempted = true
    try {
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            return null
        }
        const { Redis } = await import('@upstash/redis')
        _redis = Redis.fromEnv()
        return _redis
    } catch {
        console.warn('[admin-session] Redis unavailable, falling back to stateless sessions')
        return null
    }
}

function getSessionSecret() {
    const secret = process.env.ADMIN_PANEL_SESSION_SECRET?.trim()
    if (!secret || secret.length < 32) {
        throw new Error('ADMIN_PANEL_SESSION_SECRET must be at least 32 characters')
    }
    return secret
}

function signPayload(payloadBase64: string) {
    const secret = getSessionSecret() // throws if missing or too short
    return crypto
        .createHmac('sha256', secret)
        .update(payloadBase64)
        .digest('base64url')
}

function encodeSession(payload: AdminSessionPayload) {
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = signPayload(payloadBase64)
    if (!signature) return null
    return `${payloadBase64}.${signature}`
}

function decodeSession(token: string): AdminSessionPayload | null {
    const [payloadBase64, signature] = token.split('.')
    if (!payloadBase64 || !signature) return null

    const expectedSignature = signPayload(payloadBase64)
    if (!expectedSignature) return null
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)
    if (signatureBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as AdminSessionPayload
        if (!payload?.email || typeof payload.exp !== 'number') return null
        if (payload.exp <= Math.floor(Date.now() / 1000)) return null
        return payload
    } catch {
        return null
    }
}

export async function setAdminSession(email: string) {
    const sid = crypto.randomUUID()
    const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS
    const token = encodeSession({ email, sid, exp })
    if (!token) {
        throw new Error('Missing admin session signing secret.')
    }

    // Store session ID in Redis for revocation support
    try {
        const redis = await getRedis()
        if (redis) {
            await redis.set(`${ADMIN_SESSION_REDIS_PREFIX}${sid}`, '1', { ex: ADMIN_SESSION_TTL_SECONDS })
        }
    } catch (error) {
        console.warn('[admin-session] Failed to store session in Redis:', error)
    }

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/admin',
        expires: new Date(exp * 1000),
    })
}

export async function clearAdminSession() {
    // Remove session from Redis before clearing cookie
    try {
        const session = await getAdminSession()
        if (session?.sid) {
            const redis = await getRedis()
            if (redis) {
                await redis.del(`${ADMIN_SESSION_REDIS_PREFIX}${session.sid}`)
            }
        }
    } catch (error) {
        console.warn('[admin-session] Failed to delete session from Redis:', error)
    }

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/admin',
        expires: new Date(0),
    })
}

export async function getAdminSession() {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (!token) return null
    const payload = decodeSession(token)
    if (!payload) return null

    // Verify session hasn't been revoked in Redis
    if (payload.sid) {
        try {
            const redis = await getRedis()
            if (redis) {
                const exists = await redis.exists(`${ADMIN_SESSION_REDIS_PREFIX}${payload.sid}`)
                if (!exists) return null
            }
            // If Redis unavailable, fall back to stateless (don't block login)
        } catch {
            // Redis error — fall back to stateless validation
        }
    }

    return payload
}

export async function requireAdminSession() {
    const session = await getAdminSession()
    if (!session) redirect('/admin/login?error=unauthorized')
    return session
}

export async function revokeAdminSession(sid: string) {
    try {
        const redis = await getRedis()
        if (redis) {
            await redis.del(`${ADMIN_SESSION_REDIS_PREFIX}${sid}`)
        }
    } catch (error) {
        console.error('[admin-session] Failed to revoke session:', error)
    }
}

export async function revokeAllAdminSessions() {
    try {
        const redis = await getRedis()
        if (!redis) return

        let cursor = 0
        do {
            const result = await redis.scan(cursor, { match: `${ADMIN_SESSION_REDIS_PREFIX}*`, count: 100 })
            cursor = result[0]
            const keys = result[1] as string[]
            if (keys.length > 0) {
                await redis.del(...keys)
            }
        } while (cursor !== 0)
    } catch (error) {
        console.error('[admin-session] Failed to revoke all sessions:', error)
    }
}
