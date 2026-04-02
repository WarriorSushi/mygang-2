'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, MailCheck } from 'lucide-react'
import Image from 'next/image'
import { signInOrSignUpWithPassword, signInWithGoogle } from "@/app/auth/actions"
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Script from 'next/script'

type PasswordAuthIntent = 'auto' | 'sign_up'

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

interface AuthWallProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    )
}

export function AuthWall({ isOpen, onClose, onSuccess }: AuthWallProps) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const [captchaHint, setCaptchaHint] = useState<string | null>(null)
    const [isTurnstileLoaded, setIsTurnstileLoaded] = useState(false)
    const [showEmailForm, setShowEmailForm] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [showTermsNudge, setShowTermsNudge] = useState(false)
    const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
    const turnstileWidgetIdRef = useRef<string | null>(null)
    const pendingIntentRef = useRef<PasswordAuthIntent | null>(null)
    const turnstileEnabled = Boolean(turnstileSiteKey) && showEmailForm && !pendingConfirmationEmail

    const handleTurnstileVerification = useEffectEvent((token: string) => {
        setCaptchaToken(token)
        setCaptchaHint(null)

        const pendingIntent = pendingIntentRef.current
        if (pendingIntent) {
            pendingIntentRef.current = null
            void runPasswordAuth(pendingIntent, token)
        }
    })

    useEffect(() => {
        if (isOpen) {
            trackEvent('auth_wall_shown', { metadata: { source: 'auth_wall' } })
        }
    }, [isOpen])

    // Reset email form when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setShowEmailForm(false)
            setErrorMessage(null)
            setPendingConfirmationEmail(null)
            setCaptchaToken(null)
            setCaptchaHint(null)
            pendingIntentRef.current = null
        }
    }, [isOpen])

    useEffect(() => {
        if (turnstileEnabled && isTurnstileLoaded && turnstileContainerRef.current && window.turnstile && !turnstileWidgetIdRef.current) {
            setCaptchaHint('We are verifying this request in the background.')
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

        if (!turnstileEnabled && window.turnstile && turnstileWidgetIdRef.current) {
            window.turnstile.remove(turnstileWidgetIdRef.current)
            turnstileWidgetIdRef.current = null
            setCaptchaToken(null)
            setCaptchaHint(null)
            pendingIntentRef.current = null
        }
    }, [isTurnstileLoaded, turnstileEnabled, turnstileSiteKey])

    const refreshTurnstile = (message: string) => {
        setCaptchaToken(null)
        setCaptchaHint(message)
        if (window.turnstile && turnstileWidgetIdRef.current) {
            window.turnstile.reset(turnstileWidgetIdRef.current)
        }
    }

    const runPasswordAuth = async (intent: PasswordAuthIntent, tokenOverride?: string) => {
        const activeToken = tokenOverride ?? captchaToken
        const requiresCaptcha = Boolean(turnstileSiteKey)

        if (requiresCaptcha && !activeToken) {
            pendingIntentRef.current = intent
            refreshTurnstile(
                intent === 'sign_up'
                    ? 'We are verifying before we create your account.'
                    : 'Please wait a second while we verify this request.'
            )
            return
        }

        setIsLoading(true)
        setErrorMessage(null)

        try {
            const result = await signInOrSignUpWithPassword(email, password, activeToken ?? undefined, intent)
            if (result?.ok) {
                if (result.action === 'confirmation_required') {
                    setPendingConfirmationEmail(result.email)
                    setPassword('')
                    return
                }

                setEmail('')
                setPassword('')
                onSuccess()
                return
            }

            if (result?.action === 'refresh_captcha_for_signup' && requiresCaptcha) {
                pendingIntentRef.current = 'sign_up'
                refreshTurnstile('We are verifying before we create your account.')
                return
            }

            setErrorMessage(result?.error || 'Unable to sign in. Please try again.')
            if (requiresCaptcha && activeToken) {
                refreshTurnstile('Please verify again to retry.')
            }
        } catch (err) {
            console.error(err)
            setErrorMessage('Unable to sign in. Please try again.')
            if (requiresCaptcha && activeToken) {
                refreshTurnstile('Please verify again to retry.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true)
        setErrorMessage(null)
        try {
            trackEvent('auth_wall_action', { metadata: { provider: 'google' } })
            await signInWithGoogle()
        } catch {
            // signInWithGoogle calls redirect(), which throws in Next.js — that's expected
        } finally {
            setIsGoogleLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!agreedToTerms) {
            setShowTermsNudge(true)
            return
        }
        if (!email || !password) return

        setErrorMessage(null)
        try {
            if (password.length < 6) {
                setErrorMessage('Password must be at least 6 characters.')
                return
            }
            trackEvent('auth_wall_action', { metadata: { provider: 'password' } })
            await runPasswordAuth('auto')
        } catch (err) {
            console.error(err)
            setErrorMessage('Unable to sign in. Please try again.')
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            {turnstileSiteKey && (
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onLoad={() => setIsTurnstileLoaded(true)}
                />
            )}
            <DialogContent data-testid="auth-wall" className="sm:max-w-md bg-background/60 backdrop-blur-3xl border-border/50 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

                <div className="p-8">
                    <DialogHeader className="flex flex-col items-center gap-5 py-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[2.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                <div className="animate-spin" style={{ animationDuration: '12s' }}>
                                    <Image src="/logo.webp" alt="MyGang" width={72} height={72} className="object-contain" priority />
                                </div>
                            </div>
                        </div>
                        <DialogTitle className="text-2xl sm:text-4xl font-black text-center tracking-tight leading-tight">
                            Join the gang
                        </DialogTitle>
                        <DialogDescription className="text-center text-base sm:text-lg text-muted-foreground/80 leading-relaxed max-w-[320px]">
                            {pendingConfirmationEmail
                                ? 'One more step and your account is ready.'
                                : 'Sign in or create an account to start chatting. It&apos;s free.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {pendingConfirmationEmail ? (
                            <div
                                data-testid="auth-email-confirmation-state"
                                className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/8 px-5 py-6 text-center"
                            >
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-500">
                                    <MailCheck className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold tracking-tight">Check your email</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    We need to verify <span className="font-semibold text-foreground">{pendingConfirmationEmail}</span> before we can finish signing you in.
                                </p>
                                <p className="mt-3 text-xs leading-relaxed text-muted-foreground/75">
                                    Click the confirmation link in your inbox and we&apos;ll bring you back automatically. If you entered the wrong address, go back and try again.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setPendingConfirmationEmail(null)
                                        setErrorMessage(null)
                                        setShowEmailForm(true)
                                    }}
                                    className="mt-5 w-full h-12 rounded-xl text-sm font-semibold border-border/60 bg-background/60 hover:bg-background/80"
                                >
                                    Use a different email
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Terms & Privacy consent */}
                                <div className="space-y-1.5">
                                    <label className={cn(
                                        "flex items-start gap-2.5 cursor-pointer select-none group",
                                        showTermsNudge && !agreedToTerms && "animate-[shake_0.5s_ease-in-out]"
                                    )}
                                        onAnimationEnd={() => setShowTermsNudge(false)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={agreedToTerms}
                                            onChange={(e) => {
                                                setAgreedToTerms(e.target.checked)
                                                if (e.target.checked) setShowTermsNudge(false)
                                            }}
                                            className={cn(
                                                "mt-0.5 h-4 w-4 rounded border-border/60 accent-primary cursor-pointer shrink-0",
                                                showTermsNudge && !agreedToTerms && "ring-2 ring-red-400/80"
                                            )}
                                        />
                                        <span className={cn(
                                            "text-xs leading-relaxed transition-colors",
                                            showTermsNudge && !agreedToTerms
                                                ? "text-red-400 font-medium"
                                                : "text-muted-foreground/70 group-hover:text-muted-foreground/90"
                                        )}>
                                            I agree to the{' '}
                                            <Link href="/terms" className="underline text-primary/80 hover:text-primary" target="_blank">Terms of Service</Link>
                                            {' '}and{' '}
                                            <Link href="/privacy" className="underline text-primary/80 hover:text-primary" target="_blank">Privacy Policy</Link>
                                        </span>
                                    </label>
                                    {showTermsNudge && !agreedToTerms && (
                                        <p className="text-[11px] text-red-400 pl-7 animate-in fade-in duration-200">
                                            Please accept the terms to continue
                                        </p>
                                    )}
                                </div>

                                {/* Google Sign-In Button */}
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (!agreedToTerms) {
                                            setShowTermsNudge(true)
                                            return
                                        }
                                        handleGoogleSignIn()
                                    }}
                                    disabled={isGoogleLoading || isLoading}
                                    className={cn(
                                        "w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-semibold bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 dark:bg-muted/60 dark:hover:bg-muted/80 dark:text-foreground dark:border-border/60 transition-all active:scale-[0.98] shadow-sm",
                                        !agreedToTerms && "opacity-60"
                                    )}
                                >
                                    {isGoogleLoading ? (
                                        <Loader2 className="animate-spin h-5 w-5" />
                                    ) : (
                                        <>
                                            <GoogleIcon className="w-5 h-5 mr-2.5 shrink-0" />
                                            Continue with Google
                                        </>
                                    )}
                                </Button>

                                {/* Divider */}
                                <div className="flex items-center gap-3 my-1">
                                    <div className="flex-1 h-px bg-border/50" />
                                    <span className="text-xs text-muted-foreground/50 uppercase tracking-widest font-medium">or</span>
                                    <div className="flex-1 h-px bg-border/50" />
                                </div>

                                {/* Email Toggle / Form */}
                                {!showEmailForm ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowEmailForm(true)}
                                        className="w-full h-10 sm:h-12 rounded-xl text-sm sm:text-base font-medium text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        Continue with email
                                    </Button>
                                ) : (
                                    <div
                                        className="animate-in fade-in slide-in-from-top-2 duration-300"
                                    >
                                        <form onSubmit={handleSubmit} className="space-y-3">
                                            <Input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                aria-label="Email address"
                                                className="h-12 sm:h-14 rounded-xl bg-muted/40 border-border/50 text-base sm:text-lg focus-visible:ring-primary/50"
                                                required
                                                autoFocus
                                            />
                                            <Input
                                                type="password"
                                                placeholder="Password (6+ characters)"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                aria-label="Password"
                                                className="h-12 sm:h-14 rounded-xl bg-muted/40 border-border/50 text-base sm:text-lg focus-visible:ring-primary/50"
                                                required
                                                minLength={6}
                                            />
                                            <div className="flex justify-end">
                                                <Link
                                                    href="/forgot-password"
                                                    className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
                                                >
                                                    Forgot password?
                                                </Link>
                                            </div>
                                            {errorMessage && (
                                                <div className="text-xs text-red-400">{errorMessage}</div>
                                            )}
                                            {turnstileEnabled && (
                                                <>
                                                    <div
                                                        ref={turnstileContainerRef}
                                                        className="min-h-[1px]"
                                                        aria-hidden="true"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground/70">
                                                        {captchaHint || 'Human verification stays in the background unless Cloudflare needs extra proof.'}
                                                    </p>
                                                </>
                                            )}
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                disabled={isLoading || isGoogleLoading}
                                                onClick={(e) => {
                                                    if (!agreedToTerms) {
                                                        e.preventDefault()
                                                        setShowTermsNudge(true)
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold border-border/50 bg-muted/40 hover:bg-muted/60 transition-all active:scale-[0.98]",
                                                    !agreedToTerms && "opacity-60"
                                                )}
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="animate-spin h-5 w-5" />
                                                ) : (
                                                    <span>Continue</span>
                                                )}
                                            </Button>
                                        </form>
                                    </div>
                                )}
                            </>
                        )}

                        <p className="text-center text-[11px] text-muted-foreground/60">
                            {pendingConfirmationEmail
                                ? 'If it does not show up right away, check spam and wait a minute before trying again.'
                                : 'Your session stays signed in on this device until you log out.'}
                        </p>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    )
}
