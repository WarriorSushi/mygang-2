'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react'
import { requestPasswordReset } from '@/app/auth/actions'

type TurnstileRenderOptions = {
    sitekey: string
    theme?: 'auto' | 'light' | 'dark'
    appearance?: 'always' | 'execute' | 'interaction-only'
    callback?: (token: string) => void
    'expired-callback'?: () => void
    'error-callback'?: () => void
}

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: TurnstileRenderOptions) => string
            reset: (widgetId?: string) => void
            remove: (widgetId?: string) => void
        }
    }
}

export default function ForgotPasswordPage() {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
    const turnstileEnabled = Boolean(turnstileSiteKey)
    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successEmail, setSuccessEmail] = useState<string | null>(null)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const [captchaHint, setCaptchaHint] = useState<string | null>(
        turnstileEnabled ? 'We are verifying this request in the background.' : null
    )
    const [isTurnstileLoaded, setIsTurnstileLoaded] = useState(false)
    const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
    const turnstileWidgetIdRef = useRef<string | null>(null)
    const pendingSubmitRef = useRef(false)

    const handleTurnstileVerification = useEffectEvent((token: string) => {
        setCaptchaToken(token)
        setCaptchaHint(null)
        setErrorMessage(null)

        if (pendingSubmitRef.current) {
            pendingSubmitRef.current = false
            void handleSubmit(token)
        }
    })

    useEffect(() => {
        if (turnstileEnabled && isTurnstileLoaded && turnstileContainerRef.current && window.turnstile && !turnstileWidgetIdRef.current) {
            turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
                sitekey: turnstileSiteKey,
                theme: 'auto',
                appearance: 'interaction-only',
                callback: (token) => handleTurnstileVerification(token),
                'expired-callback': () => {
                    setCaptchaToken(null)
                    setCaptchaHint('Verification expired. We are refreshing it now.')
                    if (window.turnstile && turnstileWidgetIdRef.current) {
                        window.turnstile.reset(turnstileWidgetIdRef.current)
                    }
                },
                'error-callback': () => {
                    setCaptchaToken(null)
                    setCaptchaHint(null)
                    setErrorMessage(
                        window.location.hostname === 'localhost'
                            ? 'Turnstile is blocked on localhost. Add localhost to the Cloudflare widget or use Turnstile test keys for local dev.'
                            : 'Human verification could not start. Please refresh and try again.'
                    )
                },
            })
        }

        return () => {
            if (window.turnstile && turnstileWidgetIdRef.current) {
                window.turnstile.remove(turnstileWidgetIdRef.current)
                turnstileWidgetIdRef.current = null
            }
        }
    }, [isTurnstileLoaded, turnstileEnabled, turnstileSiteKey])

    const refreshTurnstile = (message: string) => {
        setCaptchaToken(null)
        setCaptchaHint(message)
        if (window.turnstile && turnstileWidgetIdRef.current) {
            window.turnstile.reset(turnstileWidgetIdRef.current)
        }
    }

    const handleSubmit = async (tokenOverride?: string) => {
        const activeToken = tokenOverride ?? captchaToken
        if (turnstileEnabled && !activeToken) {
            pendingSubmitRef.current = true
            refreshTurnstile('Please wait a second while we verify this request.')
            return
        }

        setIsSubmitting(true)
        setErrorMessage(null)

        try {
            const result = await requestPasswordReset(email, activeToken ?? undefined)
            if (!result.ok) {
                setErrorMessage(result.error || 'Unable to send a reset link right now.')
                if (turnstileEnabled && activeToken) {
                    refreshTurnstile('Please verify again to retry.')
                }
                return
            }

            setSuccessEmail(result.email)
            setCaptchaToken(null)
            setCaptchaHint(null)
        } catch (error) {
            console.error(error)
            setErrorMessage('Unable to send a reset link right now.')
            if (turnstileEnabled && activeToken) {
                refreshTurnstile('Please verify again to retry.')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main
            id="main-content"
            className="relative min-h-dvh overflow-hidden bg-[#06090f] px-4 py-8 text-foreground sm:px-6 lg:px-8"
        >
            {turnstileEnabled && (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onLoad={() => setIsTurnstileLoaded(true)}
                />
            )}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,0.24),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(16,185,129,0.16),transparent_38%)]" />
            <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
                <section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(7,12,20,0.74)] shadow-[0_40px_90px_-48px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                    <div className="border-b border-white/10 px-6 py-5 sm:px-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/75 transition-colors hover:text-white"
                        >
                            <ArrowLeft size={12} />
                            Back to home
                        </Link>
                    </div>

                    <div className="px-6 py-8 sm:px-8 sm:py-10">
                        {successEmail ? (
                            <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/8 px-5 py-6 text-center">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-400">
                                    <MailCheck className="h-7 w-7" />
                                </div>
                                <h1 className="text-2xl font-black tracking-tight">Check your email</h1>
                                <p className="mt-3 text-sm leading-relaxed text-slate-300/85">
                                    If an account exists for <span className="font-semibold text-white">{successEmail}</span>, we just sent a password reset link.
                                </p>
                                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                    Open the newest link on this same device and we&apos;ll take you straight to the new-password screen.
                                </p>
                                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSuccessEmail(null)
                                            setErrorMessage(null)
                                            refreshTurnstile('We are verifying this request in the background.')
                                        }}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold transition-colors hover:bg-white/[0.07]"
                                    >
                                        Send another link
                                    </button>
                                    <Link
                                        href="/"
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                                    >
                                        Back to login
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-3 text-center sm:text-left">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                                        <KeyRound size={12} />
                                        Password Recovery
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-50">
                                        Reset your password
                                    </h1>
                                    <p className="text-sm leading-relaxed text-slate-300/80">
                                        Enter the email tied to your MyGang account and we&apos;ll send you a secure link to set a new password.
                                    </p>
                                </div>

                                <form
                                    className="space-y-4"
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        void handleSubmit()
                                    }}
                                >
                                    <div className="space-y-1.5">
                                        <label htmlFor="forgot-email" className="block text-[11px] uppercase tracking-wider text-slate-300/65">
                                            Email
                                        </label>
                                        <input
                                            id="forgot-email"
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            autoComplete="email"
                                            placeholder="you@example.com"
                                            required
                                            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm outline-none transition-colors placeholder:text-slate-400/60 focus:border-sky-300/60"
                                        />
                                    </div>

                                    {turnstileEnabled && (
                                        <>
                                            <div ref={turnstileContainerRef} className="min-h-[1px]" aria-hidden="true" />
                                            <p className="text-[11px] text-slate-400">
                                                {captchaHint || 'Human verification stays in the background unless Cloudflare needs extra proof.'}
                                            </p>
                                        </>
                                    )}

                                    {errorMessage && (
                                        <p className="text-sm text-rose-300">{errorMessage}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            'Send reset link'
                                        )}
                                    </button>
                                </form>

                                <p className="text-xs leading-relaxed text-slate-400">
                                    If you usually sign in with Google, you may not have a password yet. In that case, go back and keep using Google sign-in.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}
