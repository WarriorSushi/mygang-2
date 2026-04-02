'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Script from 'next/script'
import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

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

type AdminLoginFormProps = {
    action: (formData: FormData) => void | Promise<void>
    configMissing: boolean
    turnstileEnabled: boolean
}

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={disabled || pending}
            className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-300/40 bg-gradient-to-r from-emerald-400/80 via-emerald-300/90 to-cyan-300/85 px-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_16px_34px_-18px_rgba(45,212,191,0.9)] transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
        >
            {pending ? (
                <Loader2 size={14} className="animate-spin" />
            ) : (
                <>
                    <span className="relative z-10">Enter Control Room</span>
                    <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0,rgba(255,255,255,0.28)_48%,transparent_100%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </>
            )}
        </button>
    )
}

export function AdminLoginForm({ action, configMissing, turnstileEnabled }: AdminLoginFormProps) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
    const renderTurnstile = turnstileEnabled && Boolean(turnstileSiteKey)
    const [captchaToken, setCaptchaToken] = useState('')
    const [captchaHint, setCaptchaHint] = useState<string | null>(
        renderTurnstile ? 'We are verifying this request in the background.' : null
    )
    const [captchaError, setCaptchaError] = useState<string | null>(null)
    const [isTurnstileLoaded, setIsTurnstileLoaded] = useState(false)
    const formRef = useRef<HTMLFormElement | null>(null)
    const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
    const turnstileWidgetIdRef = useRef<string | null>(null)
    const pendingSubmitRef = useRef(false)

    const handleTurnstileVerification = useEffectEvent((token: string) => {
        setCaptchaToken(token)
        setCaptchaHint(null)
        setCaptchaError(null)

        if (pendingSubmitRef.current && formRef.current) {
            pendingSubmitRef.current = false
            formRef.current.requestSubmit()
        }
    })

    useEffect(() => {
        if (renderTurnstile && isTurnstileLoaded && turnstileContainerRef.current && window.turnstile && !turnstileWidgetIdRef.current) {
            turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
                sitekey: turnstileSiteKey,
                theme: 'auto',
                appearance: 'interaction-only',
                callback: (token) => handleTurnstileVerification(token),
                'expired-callback': () => {
                    setCaptchaToken('')
                    setCaptchaHint('Verification expired. We are refreshing it now.')
                    if (window.turnstile && turnstileWidgetIdRef.current) {
                        window.turnstile.reset(turnstileWidgetIdRef.current)
                    }
                },
                'error-callback': () => {
                    setCaptchaToken('')
                    setCaptchaHint(null)
                    setCaptchaError(
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
    }, [isTurnstileLoaded, renderTurnstile, turnstileSiteKey])

    const refreshTurnstile = (message: string) => {
        setCaptchaToken('')
        setCaptchaHint(message)
        setCaptchaError(null)
        if (window.turnstile && turnstileWidgetIdRef.current) {
            window.turnstile.reset(turnstileWidgetIdRef.current)
        }
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        if (!renderTurnstile || captchaToken) {
            return
        }

        event.preventDefault()
        pendingSubmitRef.current = true
        refreshTurnstile('Please wait a second while we verify this request.')
    }

    return (
        <>
            {renderTurnstile && (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onLoad={() => setIsTurnstileLoaded(true)}
                />
            )}
            <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label htmlFor="admin-email" className="block text-[11px] uppercase tracking-wider text-muted-foreground">Email</label>
                    <input
                        id="admin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm outline-none transition-colors focus:border-primary/60"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="admin-password" className="block text-[11px] uppercase tracking-wider text-muted-foreground">Password</label>
                    <input
                        id="admin-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm outline-none transition-colors focus:border-primary/60"
                    />
                </div>
                {renderTurnstile && (
                    <>
                        <input type="hidden" name="turnstileToken" value={captchaToken} />
                        <div ref={turnstileContainerRef} className="min-h-[1px]" aria-hidden="true" />
                        <p className="text-[11px] text-muted-foreground">
                            {captchaHint || 'Human verification stays in the background unless Cloudflare needs extra proof.'}
                        </p>
                    </>
                )}
                {captchaError && (
                    <p className="text-xs text-destructive">{captchaError}</p>
                )}
                <SubmitButton disabled={configMissing} />
            </form>
        </>
    )
}
