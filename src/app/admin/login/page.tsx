import Link from 'next/link'
import { adminSignIn } from '@/app/admin/actions'
import { getAdminConfigMode } from '@/lib/admin/auth'
import { getAdminSession } from '@/lib/admin/session'
import { redirect } from 'next/navigation'
import { Shield, Sparkles, LockKeyhole, ArrowRight, CircleAlert } from 'lucide-react'

type AdminLoginPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getMessageText(errorCode: string | null, messageCode: string | null, retrySeconds: number | null) {
    if (errorCode === 'config') {
        return {
            tone: 'error',
            text: 'Admin credentials are not configured in environment variables.',
        }
    }
    if (errorCode === 'invalid') {
        return {
            tone: 'error',
            text: 'Invalid admin email or password.',
        }
    }
    if (errorCode === 'unauthorized') {
        return {
            tone: 'error',
            text: 'Please log in to access admin routes.',
        }
    }
    if (errorCode === 'origin') {
        return {
            tone: 'error',
            text: 'Request origin check failed. Retry from the admin page directly.',
        }
    }
    if (errorCode === 'locked') {
        const seconds = retrySeconds ?? 900
        const minutes = Math.floor(seconds / 60)
        const remSeconds = seconds % 60
        const label = minutes > 0
            ? `${minutes}m${remSeconds > 0 ? ` ${remSeconds}s` : ''}`
            : `${remSeconds}s`
        return {
            tone: 'error',
            text: `Too many failed attempts. Try again in about ${label}.`,
        }
    }
    if (messageCode === 'signed_out') {
        return {
            tone: 'info',
            text: 'Signed out from admin panel.',
        }
    }
    return null
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
    const session = await getAdminSession()
    if (session) {
        redirect('/admin/overview')
    }

    const params = await searchParams
    const errorCodeRaw = params.error
    const messageCodeRaw = params.message
    const retryRaw = params.retry
    const errorCode = Array.isArray(errorCodeRaw) ? errorCodeRaw[0] : errorCodeRaw || null
    const messageCode = Array.isArray(messageCodeRaw) ? messageCodeRaw[0] : messageCodeRaw || null
    const retryValue = Array.isArray(retryRaw) ? retryRaw[0] : retryRaw
    const retrySeconds = retryValue ? Number(retryValue) : null
    const safeRetrySeconds = Number.isFinite(retrySeconds) && (retrySeconds ?? 0) > 0 ? retrySeconds : null
    const notice = getMessageText(errorCode, messageCode, safeRetrySeconds)
    const configMode = getAdminConfigMode()
    const configMissing = configMode === 'missing'

    return (
        <main className="relative min-h-dvh overflow-hidden bg-[#06090f] text-foreground">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(29,78,216,0.28),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(16,185,129,0.22),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(245,158,11,0.18),transparent_45%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0)_35%,rgba(255,255,255,0.03)_100%)]" />
            <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
                <section className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-[rgba(7,12,20,0.72)] shadow-[0_40px_90px_-48px_rgba(15,23,42,0.9)] backdrop-blur-xl lg:grid-cols-[1.1fr_1fr]">
                    <div className="relative hidden border-r border-white/10 px-8 py-10 lg:block">
                        <div className="absolute -left-16 top-12 h-44 w-44 rounded-full bg-emerald-500/20 blur-3xl" />
                        <div className="absolute bottom-8 right-8 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
                        <div className="relative space-y-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                                <Shield size={12} />
                                Restricted Access
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300/70">MyGang Operations</p>
                                <h1 className="mt-2 text-3xl font-black leading-tight text-slate-100">
                                    Control Room
                                    <span className="block text-emerald-300">for Live Runtime.</span>
                                </h1>
                                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300/85">
                                    Manage cost controls, inspect delivery health, and run emergency user operations from one secure panel.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/70">Runtime Safety</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-100">Global low-cost override and capacity protection.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/70">Operational Controls</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-100">Per-user quota reset, tier updates, and timeline cleanup.</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/70">Auditability</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-100">Every control action is recorded with actor and request metadata.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 py-6 sm:px-8 sm:py-8">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Admin Access</p>
                                <h2 className="mt-1 text-2xl font-black tracking-tight">Sign In To MyGang Admin</h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Restricted operations dashboard
                                </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary">
                                <Sparkles size={17} />
                            </div>
                        </div>

                        {notice && (
                            <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'error'
                                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                }`}
                            >
                                <CircleAlert size={14} className="mt-[1px] shrink-0" />
                                <span>{notice.text}</span>
                            </div>
                        )}

                        {configMissing && (
                            <div className="mb-4 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                                Set `ADMIN_PANEL_EMAIL` and `ADMIN_PANEL_PASSWORD_HASH` (or fallback `ADMIN_PANEL_PASSWORD`) in environment variables.
                            </div>
                        )}

                        <form action={adminSignIn} className="space-y-4">
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
                                <div className="relative">
                                    <LockKeyhole size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/75" />
                                    <input
                                        id="admin-password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={configMissing}
                                className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-300/40 bg-gradient-to-r from-emerald-400/80 via-emerald-300/90 to-cyan-300/85 px-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_16px_34px_-18px_rgba(45,212,191,0.9)] transition-all hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <span className="relative z-10">Enter Control Room</span>
                                <ArrowRight size={14} className="relative z-10 transition-transform group-hover:translate-x-0.5" />
                                <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0,rgba(255,255,255,0.28)_48%,transparent_100%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                            </button>
                            {configMode === 'hash' && (
                                <p className="text-[11px] text-muted-foreground">
                                    Password field accepts your original admin password. It also accepts the exact configured SHA-256 hash if needed.
                                </p>
                            )}
                        </form>

                        <div className="mt-5 text-center">
                            <Link href="/" className="text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                                Back to app
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
