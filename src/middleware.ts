import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64))

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

    try {
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')))
        if (!payload?.email || typeof payload.exp !== 'number') return false
        if (payload.exp <= Math.floor(Date.now() / 1000)) return false
        return true
    } catch {
        return false
    }
}

export async function middleware(request: NextRequest) {
    // Admin route protection
    if (isAdminProtectedPath(request.nextUrl.pathname)) {
        const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
        if (!sessionCookie || !(await verifyAdminToken(sessionCookie))) {
            const loginUrl = new URL('/admin/login', request.url)
            loginUrl.searchParams.set('error', 'unauthorized')
            return NextResponse.redirect(loginUrl)
        }
    }

    // Supabase auth session refresh
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session - this is important for keeping auth tokens fresh
    await supabase.auth.getUser()

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
