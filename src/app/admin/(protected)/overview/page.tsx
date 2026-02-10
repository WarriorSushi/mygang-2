import { createAdminClient } from '@/lib/supabase/admin'
import { setGlobalLowCostOverride } from '@/app/admin/actions'

type OverviewPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ChatRouteMetricMetadata = {
    source?: 'user' | 'autonomous' | 'autonomous_idle'
    status?: number
    providerUsed?: 'gemini' | 'openrouter' | 'fallback'
    providerCapacityBlocked?: boolean
    elapsedMs?: number
}

function formatNumber(value: number | null) {
    return new Intl.NumberFormat('en-US').format(value || 0)
}

function metricFromMetadata(metadata: unknown): ChatRouteMetricMetadata {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
    const value = metadata as Record<string, unknown>
    return {
        source: typeof value.source === 'string' ? value.source as ChatRouteMetricMetadata['source'] : undefined,
        status: typeof value.status === 'number' ? value.status : undefined,
        providerUsed: typeof value.providerUsed === 'string' ? value.providerUsed as ChatRouteMetricMetadata['providerUsed'] : undefined,
        providerCapacityBlocked: typeof value.providerCapacityBlocked === 'boolean' ? value.providerCapacityBlocked : undefined,
        elapsedMs: typeof value.elapsedMs === 'number' ? value.elapsedMs : undefined,
    }
}

function getNotice(errorCode: string | null, messageCode: string | null) {
    if (errorCode === 'settings_update_failed') {
        return {
            tone: 'error',
            text: 'Could not update admin runtime settings. Check logs and retry.',
        }
    }
    if (messageCode === 'override_saved') {
        return {
            tone: 'info',
            text: 'Global low-cost override updated.',
        }
    }
    return null
}

export default async function AdminOverviewPage({ searchParams }: OverviewPageProps) {
    const admin = createAdminClient()
    const since = new Date()
    since.setHours(since.getHours() - 24)
    const since24h = since.toISOString()
    const params = await searchParams
    const errorCodeRaw = params.error
    const messageCodeRaw = params.message
    const errorCode = Array.isArray(errorCodeRaw) ? errorCodeRaw[0] : errorCodeRaw || null
    const messageCode = Array.isArray(messageCodeRaw) ? messageCodeRaw[0] : messageCodeRaw || null
    const notice = getNotice(errorCode, messageCode)

    const [
        { count: usersCount, error: usersError },
        { count: chatsCount, error: chatsError },
        { count: chats24hCount, error: chats24hError },
        { count: memoriesCount, error: memoriesError },
        { data: recentChatRows, error: recentChatError },
        { data: runtimeSettingsRow, error: runtimeSettingsError },
        { data: routeMetricRows, error: routeMetricsError },
        { data: auditRows, error: auditError },
    ] = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
        admin.from('memories').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('user_id, speaker, created_at').order('created_at', { ascending: false }).limit(20),
        admin.from('admin_runtime_settings').select('id, global_low_cost_override, updated_by, updated_at').eq('id', 'global').maybeSingle(),
        admin.from('analytics_events').select('metadata, created_at').eq('event', 'chat_route_metrics').gte('created_at', since24h).order('created_at', { ascending: false }).limit(600),
        admin.from('admin_audit_log').select('actor_email, action, details, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    const hasAnyError = !!(
        usersError
        || chatsError
        || chats24hError
        || memoriesError
        || recentChatError
        || (runtimeSettingsError && runtimeSettingsError.code !== 'PGRST205' && runtimeSettingsError.code !== '42P01')
        || (routeMetricsError && routeMetricsError.code !== 'PGRST205' && routeMetricsError.code !== '42P01')
        || (auditError && auditError.code !== 'PGRST205' && auditError.code !== '42P01')
    )

    const metrics = (routeMetricRows || []).map((row) => metricFromMetadata(row.metadata))
    const totalRouteCalls24h = metrics.length
    const capacityBlocked24h = metrics.filter((m) => m.status === 429 && m.providerCapacityBlocked).length
    const hardFailures24h = metrics.filter((m) => m.status === 500).length
    const avgLatencyMs = metrics.length > 0
        ? Math.round(metrics.reduce((sum, m) => sum + (m.elapsedMs || 0), 0) / metrics.length)
        : 0
    const sourceMix = {
        user: metrics.filter((m) => m.source === 'user').length,
        autonomous: metrics.filter((m) => m.source === 'autonomous').length,
        autonomousIdle: metrics.filter((m) => m.source === 'autonomous_idle').length,
    }
    const providerMix = {
        gemini: metrics.filter((m) => m.providerUsed === 'gemini').length,
        openrouter: metrics.filter((m) => m.providerUsed === 'openrouter').length,
        fallback: metrics.filter((m) => m.providerUsed === 'fallback').length,
    }

    const globalLowCostOverride = !!runtimeSettingsRow?.global_low_cost_override

    return (
        <section className="space-y-4">
            <div>
                <h1 className="text-2xl font-black">Overview</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Operations, capacity pressure, and runtime controls.
                </p>
            </div>

            {notice && (
                <div className={`rounded-xl border px-3 py-2 text-xs ${notice.tone === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                    }`}
                >
                    {notice.text}
                </div>
            )}

            {hasAnyError && (
                <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    Some metrics could not be loaded completely. Check server logs for query details.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Users</p>
                    <p className="text-xl font-black mt-1">{formatNumber(usersCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chat Rows</p>
                    <p className="text-xl font-black mt-1">{formatNumber(chatsCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chat Rows (24h)</p>
                    <p className="text-xl font-black mt-1">{formatNumber(chats24hCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Memories</p>
                    <p className="text-xl font-black mt-1">{formatNumber(memoriesCount)}</p>
                </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Global Cost Control</p>
                        <p className="text-sm font-semibold mt-1">
                            Override is {globalLowCostOverride ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Forces low-cost behavior for all chat requests.
                        </p>
                        {runtimeSettingsRow?.updated_at && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Updated by {runtimeSettingsRow?.updated_by || 'system'} at {new Date(runtimeSettingsRow.updated_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <form action={setGlobalLowCostOverride}>
                        <input type="hidden" name="enabled" value={globalLowCostOverride ? 'false' : 'true'} />
                        <button
                            type="submit"
                            className={`rounded-lg border px-3 py-2 text-[11px] uppercase tracking-wider font-bold ${globalLowCostOverride
                                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                                : 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                                }`}
                        >
                            {globalLowCostOverride ? 'Disable Override' : 'Enable Override'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Route Calls (24h)</p>
                    <p className="text-xl font-black mt-1">{formatNumber(totalRouteCalls24h)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Capacity Blocks (24h)</p>
                    <p className="text-xl font-black mt-1">{formatNumber(capacityBlocked24h)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">500s (24h)</p>
                    <p className="text-xl font-black mt-1">{formatNumber(hardFailures24h)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Avg Route Latency</p>
                    <p className="text-xl font-black mt-1">{formatNumber(avgLatencyMs)}ms</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Source Mix (24h)</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div>User: <span className="text-foreground font-medium">{formatNumber(sourceMix.user)}</span></div>
                        <div>Autonomous: <span className="text-foreground font-medium">{formatNumber(sourceMix.autonomous)}</span></div>
                        <div>Autonomous Idle: <span className="text-foreground font-medium">{formatNumber(sourceMix.autonomousIdle)}</span></div>
                    </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Provider Mix (24h)</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div>Gemini: <span className="text-foreground font-medium">{formatNumber(providerMix.gemini)}</span></div>
                        <div>OpenRouter: <span className="text-foreground font-medium">{formatNumber(providerMix.openrouter)}</span></div>
                        <div>Fallback: <span className="text-foreground font-medium">{formatNumber(providerMix.fallback)}</span></div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Recent Chat Activity</p>
                {recentChatRows && recentChatRows.length > 0 ? (
                    <div className="space-y-1">
                        {recentChatRows.map((row, index) => (
                            <div key={`${row.user_id}-${row.created_at}-${index}`} className="text-xs text-muted-foreground">
                                <span className="text-foreground font-medium">{row.speaker}</span>
                                {' '}| user {(row.user_id || 'guest').slice(0, 8)}...
                                {' '}| {new Date(row.created_at).toLocaleString()}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">No recent rows available.</p>
                )}
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Admin Audit Log</p>
                {auditRows && auditRows.length > 0 ? (
                    <div className="space-y-1">
                        {auditRows.map((row, index) => (
                            <div key={`${row.created_at}-${row.action}-${index}`} className="text-xs text-muted-foreground">
                                <span className="text-foreground font-medium">{row.action}</span>
                                {' '}| {row.actor_email}
                                {' '}| {new Date(row.created_at).toLocaleString()}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">No audit actions recorded yet.</p>
                )}
            </div>
        </section>
    )
}
