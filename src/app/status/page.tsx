import packageJson from '../../../package.json'
import { getStatusSnapshot, type HealthCheckStatus } from '@/lib/status/health'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<HealthCheckStatus, { badge: string; text: string; border: string }> = {
    pass: {
        badge: 'bg-emerald-500/12 text-emerald-300',
        text: 'Healthy',
        border: 'border-emerald-500/20',
    },
    warn: {
        badge: 'bg-amber-500/12 text-amber-200',
        text: 'Needs attention',
        border: 'border-amber-500/20',
    },
    fail: {
        badge: 'bg-rose-500/12 text-rose-200',
        text: 'Action required',
        border: 'border-rose-500/20',
    },
}

function getOverallStatus(checks: Awaited<ReturnType<typeof getStatusSnapshot>>['checks']): HealthCheckStatus {
    if (checks.some((check) => check.status === 'fail')) return 'fail'
    if (checks.some((check) => check.status === 'warn')) return 'warn'
    return 'pass'
}

export default async function StatusPage() {
    const snapshot = await getStatusSnapshot()
    const overallStatus = getOverallStatus(snapshot.checks)
    const overallStyle = STATUS_STYLES[overallStatus]

    return (
        <main className="min-h-dvh bg-background text-foreground px-6 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
                    <h1 className="text-3xl font-black">MyGang Runtime Diagnostics</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Read-only environment and service checks for this deployment. This page never exposes secrets and only performs lightweight reachability checks.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className={`rounded-2xl border bg-muted/40 p-5 ${overallStyle.border}`}>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Overall</div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${overallStyle.badge}`}>
                                {overallStyle.text}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                Updated {snapshot.generatedAt}
                            </span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                            {overallStatus === 'pass'
                                ? 'All configured checks passed.'
                                : overallStatus === 'warn'
                                    ? 'No hard failures, but at least one launch-sensitive dependency still needs attention.'
                                    : 'One or more critical checks failed. Treat this deployment as not launch-ready.'}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-5">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Build metadata</div>
                        <dl className="mt-3 space-y-3 text-sm">
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Version</dt>
                                <dd className="font-medium">{packageJson.version}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Commit</dt>
                                <dd className="font-medium break-all">{snapshot.commitSha ?? 'Unavailable'}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Site URL</dt>
                                <dd className="font-medium break-all">{snapshot.siteUrl ?? 'Fallback to https://mygang.ai'}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Node env</dt>
                                <dd className="font-medium">{process.env.NODE_ENV ?? 'unknown'}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {snapshot.checks.map((check) => {
                        const style = STATUS_STYLES[check.status]

                        return (
                            <section
                                key={check.id}
                                className={`rounded-2xl border bg-muted/40 p-5 ${style.border}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-widest text-muted-foreground">{check.label}</div>
                                        <div className="mt-2 text-lg font-semibold">{check.summary}</div>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
                                        {check.status}
                                    </span>
                                </div>
                                {check.detail && (
                                    <p className="mt-3 text-sm text-muted-foreground">{check.detail}</p>
                                )}
                            </section>
                        )
                    })}
                </div>
            </div>
        </main>
    )
}
