import Link from 'next/link'
import { adminSignIn } from '@/app/admin/actions'
import { getAdminConfigMode } from '@/lib/admin/auth'
import { getAdminSession } from '@/lib/admin/session'
import { redirect } from 'next/navigation'

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
        <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/70 p-5 shadow-[0_16px_38px_-26px_rgba(2,6,23,0.9)]">
                <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Admin Access</p>
                    <h1 className="text-xl font-black mt-1">MyGang Admin</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Restricted operations dashboard
                    </p>
                </div>

                {notice && (
                    <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${notice.tone === 'error'
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                        }`}
                    >
                        {notice.text}
                    </div>
                )}

                {configMissing && (
                    <div className="mb-3 rounded-lg border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                        Set `ADMIN_PANEL_EMAIL` and `ADMIN_PANEL_PASSWORD_HASH` (or fallback `ADMIN_PANEL_PASSWORD`) in environment variables.
                    </div>
                )}

                <form action={adminSignIn} className="space-y-3">
                    <div>
                        <label htmlFor="admin-email" className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Email</label>
                        <input
                            id="admin-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-password" className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Password</label>
                        <input
                            id="admin-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={configMissing}
                        className="h-10 w-full rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.16em] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sign In
                    </button>
                    {configMode === 'hash' && (
                        <p className="text-[11px] text-muted-foreground">
                            Password field accepts your original admin password. If needed, it also accepts the exact configured SHA-256 hash.
                        </p>
                    )}
                </form>

                <div className="mt-4 text-center">
                    <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        Back to app
                    </Link>
                </div>
            </div>
        </main>
    )
}
