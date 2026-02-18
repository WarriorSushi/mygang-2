import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_SESSION_COOKIE = 'mygang_admin_session'

function isAdminProtectedPath(pathname: string) {
    if (!pathname.startsWith('/admin')) return false
    if (pathname === '/admin' || pathname === '/admin/login') return false
    return true
}

async function verifyAdminToken(token: string): Promise<boolean> {
    const secret = process.env.ADMIN_PANEL_SESSION_SECRET?.trim()
    if (!secret) return false

    const [payloadBase64, signature] = token.split('.')
    if (!payloadBase64 || !signature) return false

    // Verify HMAC-SHA256 signature using Web Crypto API (Edge-compatible)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64))

    // Convert to base64url for comparison
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

    // Constant-time comparison to prevent timing side-channel attacks
    if (signature.length !== expectedSignature.length) return false
    const a = encoder.encode(signature)
    const b = encoder.encode(expectedSignature)
    if (a.byteLength !== b.byteLength) return false
    let mismatch = 0
    for (let i = 0; i < a.byteLength; i++) {
        mismatch |= a[i] ^ b[i]
    }
    if (mismatch !== 0) return false

    // Verify expiration
    try {
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')))
        if (!payload?.email || typeof payload.exp !== 'number') return false
        if (payload.exp <= Math.floor(Date.now() / 1000)) return false
        return true
    } catch {
        return false
    }
}

export async function proxy(req: NextRequest) {
    // Admin route protection
    if (isAdminProtectedPath(req.nextUrl.pathname)) {
        const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
        if (!sessionCookie || !(await verifyAdminToken(sessionCookie))) {
            const loginUrl = new URL('/admin/login', req.url)
            loginUrl.searchParams.set('error', 'unauthorized')
            return NextResponse.redirect(loginUrl)
        }
    }

    // Supabase auth session refresh — keeps auth tokens fresh on every request
    let supabaseResponse = NextResponse.next({ request: req })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        req.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request: req })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    await supabase.auth.getUser()

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
