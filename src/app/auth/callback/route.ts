import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in search params, use it as the redirection URL
    const requestedNext = searchParams.get('next') ?? '/post-auth'
    const ALLOWED_REDIRECTS = new Set(['/post-auth', '/chat', '/settings', '/onboarding', '/reset-password'])
    const next = (
        requestedNext.startsWith('/') &&
        !requestedNext.startsWith('//') &&
        !requestedNext.includes('\\') &&
        ALLOWED_REDIRECTS.has(requestedNext)
    ) ? requestedNext : '/post-auth'

    const buildRedirectTarget = (path: string, params?: Record<string, string>) => {
        const target = new URL(path, origin)
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                target.searchParams.set(key, value)
            }
        }
        return target.toString()
    }

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            if (next === '/reset-password') {
                return NextResponse.redirect(buildRedirectTarget('/reset-password', { mode: 'recovery' }))
            }
            return NextResponse.redirect(buildRedirectTarget(next))
        }
    }

    if (next === '/reset-password') {
        return NextResponse.redirect(buildRedirectTarget('/reset-password', { error: 'invalid_or_expired' }))
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
