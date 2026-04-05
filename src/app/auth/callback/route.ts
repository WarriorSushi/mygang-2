import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateEventId, buildCompleteRegistrationEvent, sendCAPIEvent } from '@/lib/meta'

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
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Detect new OAuth signups: created_at within the last 30 seconds
            const user = sessionData?.user
            const isNewUser = user?.created_at
                ? (Date.now() - new Date(user.created_at).getTime()) < 30_000
                : false

            let regEventId: string | undefined
            if (isNewUser && user?.email) {
                regEventId = generateEventId()
                // Fire CAPI — non-blocking
                void (async () => {
                    try {
                        const { headers } = await import('next/headers')
                        const headerBag = await headers()
                        const ip = headerBag.get('x-forwarded-for')?.split(',')[0]?.trim()
                            || headerBag.get('x-real-ip')
                            || 'unknown'
                        const userAgent = headerBag.get('user-agent') || ''
                        await sendCAPIEvent([
                            buildCompleteRegistrationEvent({
                                eventId: regEventId!,
                                email: user.email!,
                                ip,
                                userAgent,
                            }),
                        ])
                    } catch { /* non-fatal */ }
                })()
            }

            if (next === '/reset-password') {
                return NextResponse.redirect(buildRedirectTarget('/reset-password', { mode: 'recovery' }))
            }

            const redirectParams: Record<string, string> = {}
            if (regEventId) redirectParams.reg_event_id = regEventId
            return NextResponse.redirect(buildRedirectTarget(next, Object.keys(redirectParams).length ? redirectParams : undefined))
        }
    }

    if (next === '/reset-password') {
        return NextResponse.redirect(buildRedirectTarget('/reset-password', { error: 'invalid_or_expired' }))
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
