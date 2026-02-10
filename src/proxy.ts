import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_SESSION_COOKIE = 'mygang_admin_session'

function isAdminProtectedPath(pathname: string) {
    if (!pathname.startsWith('/admin')) return false
    if (pathname === '/admin' || pathname === '/admin/login') return false
    return true
}

export function proxy(req: NextRequest) {
    if (!isAdminProtectedPath(req.nextUrl.pathname)) {
        return NextResponse.next()
    }

    const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (sessionCookie) {
        return NextResponse.next()
    }

    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(loginUrl)
}

export const config = {
    matcher: ['/admin/:path*'],
}
