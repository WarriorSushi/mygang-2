import crypto from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const ADMIN_SESSION_COOKIE = 'mygang_admin_session'
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12

type AdminSessionPayload = {
    email: string
    exp: number
}

function getSessionSecret() {
    const explicit = process.env.ADMIN_PANEL_SESSION_SECRET?.trim()
    if (explicit) return explicit
    return process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
        || process.env.ADMIN_PANEL_PASSWORD?.trim()
        || null
}

function signPayload(payloadBase64: string) {
    const secret = getSessionSecret()
    if (!secret) return null
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
    const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS
    const token = encodeSession({ email, exp })
    if (!token) {
        throw new Error('Missing admin session signing secret.')
    }
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/admin',
        expires: new Date(exp * 1000),
    })
}

export async function clearAdminSession() {
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/admin',
        expires: new Date(0),
    })
}

export async function getAdminSession() {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (!token) return null
    return decodeSession(token)
}

export async function requireAdminSession() {
    const session = await getAdminSession()
    if (!session) redirect('/admin/login?error=unauthorized')
    return session
}
