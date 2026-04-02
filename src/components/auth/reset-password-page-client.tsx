'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ResetState = 'checking' | 'ready' | 'invalid' | 'submitting' | 'success'

type ResetPasswordPageClientProps = {
    initialErrorCode: string | null
}

function getInitialResetState(initialErrorCode: string | null) {
    if (initialErrorCode === 'invalid_or_expired') {
        return {
            status: 'invalid' as const,
            errorMessage: 'This reset link is invalid or has already expired. Request a new one to continue.',
        }
    }

    return {
        status: 'checking' as const,
        errorMessage: null,
    }
}

export function ResetPasswordPageClient({ initialErrorCode }: ResetPasswordPageClientProps) {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const initialState = getInitialResetState(initialErrorCode)
    const [status, setStatus] = useState<ResetState>(initialState.status)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>(initialState.errorMessage)

    useEffect(() => {
        if (initialErrorCode === 'invalid_or_expired') {
            return
        }

        let isCancelled = false

        const resolveSession = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (isCancelled) return

            if (user) {
                setStatus('ready')
                setErrorMessage(null)
            }
        }

        void resolveSession()

        const timeout = window.setTimeout(() => {
            if (!isCancelled) {
                setStatus('invalid')
                setErrorMessage('We could not verify your recovery session. Request a fresh reset link and try again.')
            }
        }, 5000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user && !isCancelled) {
                window.clearTimeout(timeout)
                setStatus('ready')
                setErrorMessage(null)
            }
        })

        return () => {
            isCancelled = true
            window.clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [initialErrorCode, supabase])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters.')
            return
        }

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.')
            return
        }

        setStatus('submitting')
        setErrorMessage(null)

        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) {
                setStatus('ready')
                setErrorMessage(error.message || 'Unable to update your password right now.')
                return
            }

            setStatus('success')
            window.setTimeout(() => {
                router.replace('/post-auth')
            }, 1400)
        } catch (error) {
            console.error(error)
            setStatus('ready')
            setErrorMessage('Unable to update your password right now.')
        }
    }

    return (
        <main
            id="main-content"
            className="relative min-h-dvh overflow-hidden bg-[#06090f] px-4 py-8 text-foreground sm:px-6 lg:px-8"
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.2),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(245,158,11,0.14),transparent_36%)]" />
            <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
                <section className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(7,12,20,0.74)] shadow-[0_40px_90px_-48px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                    <div className="px-6 py-8 sm:px-8 sm:py-10">
                        {status === 'checking' && (
                            <div className="space-y-5 py-8 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-400/12 text-sky-300">
                                    <Loader2 className="h-7 w-7 animate-spin" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-2xl font-black tracking-tight text-slate-50">Verifying your reset link</h1>
                                    <p className="text-sm leading-relaxed text-slate-300/80">
                                        Hold tight while we confirm your recovery session and prepare the password reset form.
                                    </p>
                                </div>
                            </div>
                        )}

                        {status === 'invalid' && (
                            <div className="space-y-5 py-4 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/12 text-rose-300">
                                    <ShieldAlert className="h-7 w-7" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-2xl font-black tracking-tight text-slate-50">This reset link can&apos;t be used</h1>
                                    <p className="text-sm leading-relaxed text-slate-300/80">
                                        {errorMessage || 'Request a fresh reset email and open the newest link instead.'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                                    <Link
                                        href="/forgot-password"
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                                    >
                                        Request a new link
                                    </Link>
                                    <Link
                                        href="/"
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold transition-colors hover:bg-white/[0.07]"
                                    >
                                        Back home
                                    </Link>
                                </div>
                            </div>
                        )}

                        {(status === 'ready' || status === 'submitting') && (
                            <div className="space-y-6">
                                <div className="space-y-3 text-center sm:text-left">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                                        <KeyRound size={12} />
                                        Secure Password Reset
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-50">
                                        Choose a new password
                                    </h1>
                                    <p className="text-sm leading-relaxed text-slate-300/80">
                                        Set a new password for your MyGang account. Once it&apos;s saved, we&apos;ll take you back into the app.
                                    </p>
                                </div>

                                <form className="space-y-4" onSubmit={handleSubmit}>
                                    <div className="space-y-1.5">
                                        <label htmlFor="new-password" className="block text-[11px] uppercase tracking-wider text-slate-300/65">
                                            New password
                                        </label>
                                        <input
                                            id="new-password"
                                            type="password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            autoComplete="new-password"
                                            placeholder="At least 6 characters"
                                            required
                                            minLength={6}
                                            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm outline-none transition-colors placeholder:text-slate-400/60 focus:border-emerald-300/60"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="confirm-password" className="block text-[11px] uppercase tracking-wider text-slate-300/65">
                                            Confirm password
                                        </label>
                                        <input
                                            id="confirm-password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(event) => setConfirmPassword(event.target.value)}
                                            autoComplete="new-password"
                                            placeholder="Repeat your new password"
                                            required
                                            minLength={6}
                                            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm outline-none transition-colors placeholder:text-slate-400/60 focus:border-emerald-300/60"
                                        />
                                    </div>

                                    {errorMessage && (
                                        <p className="text-sm text-rose-300">{errorMessage}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={status === 'submitting'}
                                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {status === 'submitting' ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            'Save new password'
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="space-y-5 py-6 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/14 text-emerald-300">
                                    <CheckCircle2 className="h-7 w-7" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-2xl font-black tracking-tight text-slate-50">Password updated</h1>
                                    <p className="text-sm leading-relaxed text-slate-300/80">
                                        Your new password is saved. We&apos;re taking you back into MyGang now.
                                    </p>
                                </div>
                                <Link
                                    href="/post-auth"
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                                >
                                    Continue now
                                </Link>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}
