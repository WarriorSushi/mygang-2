import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { resetAllUserDailyUsage, setAllUsersLowCostMode, setGlobalLowCostOverride } from '@/app/admin/actions'
import { Activity, Gauge, Zap, Shield, UsersRound, ArrowRight, Clock4 } from 'lucide-react'

type OverviewPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ChatRouteMetricMetadata = {
    source?: 'user' | 'autonomous' | 'autonomous_idle'
    status?: number
    providerUsed?: 'openrouter' | 'fallback'
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
        return { tone: 'error', text: 'Could not update admin runtime settings. Check logs and retry.' }
    }
    if (errorCode === 'invalid_request') {
        return { tone: 'error', text: 'Request origin check failed. Retry from the admin dashboard.' }
    }
    if (errorCode === 'bulk_reset_failed') {
        return { tone: 'error', text: 'Could not reset daily usage for all users.' }
    }
    if (errorCode === 'bulk_low_cost_failed') {
        return { tone: 'error', text: 'Could not update low-cost mode for all users.' }
    }
    if (messageCode === 'override_saved') {
        return { tone: 'info', text: 'Global low-cost override updated.' }
    }
    if (messageCode === 'all_daily_reset_saved') {
        return { tone: 'info', text: 'All user daily counters were reset.' }
    }
    if (messageCode === 'all_low_cost_saved') {
        return { tone: 'info', text: 'Low-cost mode was updated for all users.' }
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

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const results = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'pro'),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('low_cost_mode', true),
        admin.from('chat_history').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
        admin.from('memories').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('user_id').gte('created_at', since24h).limit(4000),
        admin.from('chat_history').select('user_id, speaker, created_at').order('created_at', { ascending: false }).limit(24),
        admin.from('admin_runtime_settings').select('id, global_low_cost_override, updated_by, updated_at').eq('id', 'global').maybeSingle(),
        admin.from('analytics_events').select('metadata, created_at').eq('event', 'chat_route_metrics').gte('created_at', since24h).order('created_at', { ascending: false }).limit(600),
        admin.from('admin_audit_log').select('actor_email, action, details, created_at').order('created_at', { ascending: false }).limit(24),
    ]) as any[]
    const [
        { count: usersCount, error: usersError },
        { count: proUsersCount, error: proUsersError },
        { count: lowCostUsersCount, error: lowCostUsersError },
        { count: chatsCount, error: chatsError },
        { count: chats24hCount, error: chats24hError },
        { count: memoriesCount, error: memoriesError },
        { data: activeUsersRows, error: activeUsersError },
        { data: recentChatRows, error: recentChatError },
        { data: runtimeSettingsRow, error: runtimeSettingsError },
        { data: routeMetricRows, error: routeMetricsError },
        { data: auditRows, error: auditError },
    ] = results
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const hasAnyError = !!(
        usersError
        || proUsersError
        || lowCostUsersError
        || chatsError
        || chats24hError
        || memoriesError
        || activeUsersError
        || recentChatError
        || (runtimeSettingsError && runtimeSettingsError.code !== 'PGRST205' && runtimeSettingsError.code !== '42P01')
        || (routeMetricsError && routeMetricsError.code !== 'PGRST205' && routeMetricsError.code !== '42P01')
        || (auditError && auditError.code !== 'PGRST205' && auditError.code !== '42P01')
    )

    const metrics: ChatRouteMetricMetadata[] = (routeMetricRows || []).map((row: any) => metricFromMetadata(row.metadata))
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
        openrouter: metrics.filter((m) => m.providerUsed === 'openrouter').length,
        fallback: metrics.filter((m) => m.providerUsed === 'fallback').length,
    }

    const uniqueActiveUsers24h = new Set(
        (activeUsersRows || [])
            .map((row: any) => row.user_id)
            .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    ).size
    const globalLowCostOverride = !!runtimeSettingsRow?.global_low_cost_override

    return (
        <section className="space-y-5">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300/70">Overview</p>
                    <h1 className="mt-2 text-3xl font-black leading-tight text-slate-100">
                        Live Runtime Control
                        <span className="block text-emerald-300">and Capacity Intelligence</span>
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
                        Track provider pressure, user activity, and production quality. Apply global controls quickly without leaving the dashboard.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href="/admin/users"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-400/16"
                        >
                            User Controls
                            <ArrowRight size={13} />
                        </Link>
                    </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Shield size={14} className="text-amber-200" />
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300/70">Global Cost Control</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">
                        Override is {globalLowCostOverride ? 'ON' : 'OFF'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300/80">
                        Forces low-cost behavior for every chat request.
                    </p>
                    {runtimeSettingsRow?.updated_at && (
                        <p className="mt-2 text-[11px] text-slate-300/70">
                            Updated by {runtimeSettingsRow?.updated_by || 'system'} at {new Date(runtimeSettingsRow.updated_at).toLocaleString()}
                        </p>
                    )}
                    <form action={setGlobalLowCostOverride} className="mt-3">
                        <input type="hidden" name="enabled" value={globalLowCostOverride ? 'false' : 'true'} />
                        <input type="hidden" name="returnTo" value="/admin/overview" />
                        <button
                            type="submit"
                            aria-pressed={globalLowCostOverride}
                            aria-label={globalLowCostOverride ? 'Disable global low-cost override' : 'Enable global low-cost override'}
                            className={`w-full rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ${globalLowCostOverride
                                ? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16'
                                : 'border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/16'
                                }`}
                        >
                            {globalLowCostOverride ? 'Disable Override' : 'Enable Override'}
                        </button>
                    </form>
                </div>
            </div>

            {notice && (
                <div className={`rounded-2xl border px-3 py-2 text-xs ${notice.tone === 'error'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                    }`}
                >
                    {notice.text}
                </div>
            )}

            {hasAnyError && (
                <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    Some metrics could not be loaded completely. Check server logs for query details.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Users</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(usersCount)}</p>
                    <p className="text-[11px] text-slate-300/75">{formatNumber(proUsersCount)} pro, {formatNumber(lowCostUsersCount)} low-cost</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Chat Rows</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(chatsCount)}</p>
                    <p className="text-[11px] text-slate-300/75">{formatNumber(chats24hCount)} in last 24h</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Active Users (24h)</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(uniqueActiveUsers24h)}</p>
                    <p className="text-[11px] text-slate-300/75">Distinct user IDs with chat activity</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Memories</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(memoriesCount)}</p>
                    <p className="text-[11px] text-slate-300/75">Vector records stored</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Zap size={14} className="text-fuchsia-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Quick Operations</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <form action={setAllUsersLowCostMode}>
                            <input type="hidden" name="returnTo" value="/admin/overview" />
                            <input type="hidden" name="enabled" value="true" />
                            <button
                                type="submit"
                                className="h-full w-full rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-400/16"
                            >
                                Enable Low-Cost For All
                            </button>
                        </form>
                        <form action={setAllUsersLowCostMode}>
                            <input type="hidden" name="returnTo" value="/admin/overview" />
                            <input type="hidden" name="enabled" value="false" />
                            <button
                                type="submit"
                                className="h-full w-full rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-400/16"
                            >
                                Disable Low-Cost For All
                            </button>
                        </form>
                        <form action={resetAllUserDailyUsage}>
                            <input type="hidden" name="returnTo" value="/admin/overview" />
                            <button
                                type="submit"
                                className="h-full w-full rounded-xl border border-blue-300/35 bg-blue-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100 transition-colors hover:bg-blue-400/16"
                            >
                                Reset All Daily Counters
                            </button>
                        </form>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Activity size={14} className="text-emerald-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Route Health (24h)</p>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span className="text-slate-300/80">Route calls</span>
                            <span className="font-semibold text-slate-100">{formatNumber(totalRouteCalls24h)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span className="text-slate-300/80">Capacity blocks (429)</span>
                            <span className="font-semibold text-slate-100">{formatNumber(capacityBlocked24h)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span className="text-slate-300/80">500s</span>
                            <span className="font-semibold text-slate-100">{formatNumber(hardFailures24h)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span className="text-slate-300/80">Avg latency</span>
                            <span className="font-semibold text-slate-100">{formatNumber(avgLatencyMs)}ms</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Gauge size={14} className="text-cyan-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Source Mix (24h)</p>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300/90">
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span>User</span>
                            <span className="font-semibold text-slate-100">{formatNumber(sourceMix.user)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span>Autonomous</span>
                            <span className="font-semibold text-slate-100">{formatNumber(sourceMix.autonomous)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span>Autonomous Idle</span>
                            <span className="font-semibold text-slate-100">{formatNumber(sourceMix.autonomousIdle)}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <UsersRound size={14} className="text-violet-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Provider Mix (24h)</p>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300/90">
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span>OpenRouter</span>
                            <span className="font-semibold text-slate-100">{formatNumber(providerMix.openrouter)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                            <span>Fallback</span>
                            <span className="font-semibold text-slate-100">{formatNumber(providerMix.fallback)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Clock4 size={14} className="text-emerald-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Recent Chat Activity</p>
                    </div>
                    {recentChatRows && recentChatRows.length > 0 ? (
                        <div className="space-y-1.5">
                            {recentChatRows.slice(0, 12).map((row: any, index: number) => (
                                <div key={`${row.user_id}-${row.created_at}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300/85">
                                    <span className="font-semibold text-slate-100">{row.speaker}</span>
                                    {' '}| user {(row.user_id || 'guest').slice(0, 8)}...
                                    {' '}| {new Date(row.created_at).toLocaleString()}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-300/80">No recent rows available.</p>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Shield size={14} className="text-amber-200" />
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/75">Admin Audit Log</p>
                    </div>
                    {auditRows && auditRows.length > 0 ? (
                        <div className="space-y-1.5">
                            {auditRows.slice(0, 12).map((row: any, index: number) => (
                                <div key={`${row.created_at}-${row.action}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300/85">
                                    <span className="font-semibold text-slate-100">{row.action}</span>
                                    {' '}| {row.actor_email}
                                    {' '}| {new Date(row.created_at).toLocaleString()}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-300/80">No audit actions recorded yet.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
