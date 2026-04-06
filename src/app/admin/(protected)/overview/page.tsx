import { createAdminClient } from '@/lib/supabase/admin'
import { resetAllUserDailyUsage, setAllUsersLowCostMode, setGlobalLowCostOverride } from '@/app/admin/actions'
import {
    Activity, Zap, Shield, UsersRound, Clock4, AlertTriangle,
    CheckCircle2, CircleAlert, TrendingUp, Server, Radio
} from 'lucide-react'

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
type QueryError = { code?: string }
type CountQueryResult = { count: number | null; error: QueryError | null }
type ActiveUserRow = { user_id: string | null }
type RecentChatRow = { user_id: string | null; speaker: string; created_at: string }
type RuntimeSettingsRow = { id: string; global_low_cost_override: boolean | null; updated_by: string | null; updated_at: string | null }
type RouteMetricRow = { metadata: unknown; created_at: string }
type AuditRow = { actor_email: string | null; action: string; details: unknown; created_at: string }
type DataQueryResult<T> = { data: T | null; error: QueryError | null }

function fmt(value: number | null) {
    return new Intl.NumberFormat('en-US').format(value || 0)
}

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

function metricFromMetadata(metadata: unknown): ChatRouteMetricMetadata {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
    const v = metadata as Record<string, unknown>
    return {
        source: typeof v.source === 'string' ? v.source as ChatRouteMetricMetadata['source'] : undefined,
        status: typeof v.status === 'number' ? v.status : undefined,
        providerUsed: typeof v.providerUsed === 'string' ? v.providerUsed as ChatRouteMetricMetadata['providerUsed'] : undefined,
        providerCapacityBlocked: typeof v.providerCapacityBlocked === 'boolean' ? v.providerCapacityBlocked : undefined,
        elapsedMs: typeof v.elapsedMs === 'number' ? v.elapsedMs : undefined,
    }
}

function getNotice(errorCode: string | null, messageCode: string | null) {
    if (errorCode === 'settings_update_failed') return { tone: 'error', text: 'Could not update runtime settings.' }
    if (errorCode === 'invalid_request') return { tone: 'error', text: 'Request origin check failed.' }
    if (errorCode === 'bulk_reset_failed') return { tone: 'error', text: 'Could not reset daily usage for all users.' }
    if (errorCode === 'bulk_low_cost_failed') return { tone: 'error', text: 'Could not update low-cost mode.' }
    if (messageCode === 'override_saved') return { tone: 'info', text: 'Global low-cost override updated.' }
    if (messageCode === 'all_daily_reset_saved') return { tone: 'info', text: 'All daily counters reset.' }
    if (messageCode === 'all_low_cost_saved') return { tone: 'info', text: 'Low-cost mode updated for all users.' }
    return null
}

export default async function AdminOverviewPage({ searchParams }: OverviewPageProps) {
    const admin = createAdminClient()
    const since = new Date()
    since.setHours(since.getHours() - 24)
    const since24h = since.toISOString()
    const params = await searchParams
    const errorCode = Array.isArray(params.error) ? params.error[0] : params.error || null
    const messageCode = Array.isArray(params.message) ? params.message[0] : params.message || null
    const notice = getNotice(errorCode, messageCode)

    const results = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'pro'),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'basic'),
        admin.from('profiles').select('*', { count: 'exact', head: true }).eq('low_cost_mode', true),
        admin.from('chat_history').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
        admin.from('memories').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('user_id').gte('created_at', since24h).limit(4000),
        admin.from('chat_history').select('user_id, speaker, created_at').order('created_at', { ascending: false }).limit(20),
        admin.from('admin_runtime_settings').select('id, global_low_cost_override, updated_by, updated_at').eq('id', 'global').maybeSingle(),
        admin.from('analytics_events').select('metadata, created_at').eq('event', 'chat_route_metrics').gte('created_at', since24h).order('created_at', { ascending: false }).limit(600),
        admin.from('admin_audit_log').select('actor_email, action, details, created_at').order('created_at', { ascending: false }).limit(20),
    ]) as [
        CountQueryResult, CountQueryResult, CountQueryResult, CountQueryResult,
        CountQueryResult, CountQueryResult, CountQueryResult,
        DataQueryResult<ActiveUserRow[]>, DataQueryResult<RecentChatRow[]>,
        DataQueryResult<RuntimeSettingsRow>,
        DataQueryResult<RouteMetricRow[]>, DataQueryResult<AuditRow[]>,
    ]

    const [
        { count: usersCount },
        { count: proUsersCount },
        { count: basicUsersCount },
        { count: lowCostUsersCount },
        { count: chatsCount },
        { count: chats24hCount },
        { count: memoriesCount },
        { data: activeUsersRows },
        { data: recentChatRows },
        { data: runtimeSettingsRow, error: runtimeSettingsError },
        { data: routeMetricRows, error: routeMetricsError },
        { data: auditRows, error: auditError },
    ] = results

    const metrics: ChatRouteMetricMetadata[] = (routeMetricRows || []).map((r) => metricFromMetadata(r.metadata))
    const totalRouteCalls = metrics.length
    const capacityBlocked = metrics.filter((m) => m.status === 429 && m.providerCapacityBlocked).length
    const hardFailures = metrics.filter((m) => m.status === 500).length
    const avgLatencyMs = metrics.length > 0
        ? Math.round(metrics.reduce((s, m) => s + (m.elapsedMs || 0), 0) / metrics.length)
        : 0
    const sourceMix = {
        user: metrics.filter((m) => m.source === 'user').length,
        autonomous: metrics.filter((m) => m.source === 'autonomous').length,
        idle: metrics.filter((m) => m.source === 'autonomous_idle').length,
    }
    const providerMix = {
        openrouter: metrics.filter((m) => m.providerUsed === 'openrouter').length,
        fallback: metrics.filter((m) => m.providerUsed === 'fallback').length,
    }
    const uniqueActiveUsers = new Set(
        (activeUsersRows || []).map((r) => r.user_id).filter((v): v is string => typeof v === 'string')
    ).size

    const globalLowCostOverride = !!runtimeSettingsRow?.global_low_cost_override
    const hasErrors = !!(
        (runtimeSettingsError && runtimeSettingsError.code !== 'PGRST205' && runtimeSettingsError.code !== '42P01') ||
        (routeMetricsError && routeMetricsError.code !== 'PGRST205' && routeMetricsError.code !== '42P01') ||
        (auditError && auditError.code !== 'PGRST205' && auditError.code !== '42P01')
    )

    // Health score: red if 500s > 5% of calls, amber if capacity blocked > 10%
    const healthStatus = hardFailures > 0 && totalRouteCalls > 0 && (hardFailures / totalRouteCalls) > 0.05
        ? 'critical'
        : capacityBlocked > 0 && totalRouteCalls > 0 && (capacityBlocked / totalRouteCalls) > 0.1
            ? 'degraded'
            : 'healthy'

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Overview</p>
                    <h1 className="mt-1 text-2xl font-black text-slate-100">Live Runtime</h1>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                    healthStatus === 'healthy' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                    healthStatus === 'degraded' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' :
                    'border-rose-400/30 bg-rose-400/10 text-rose-300'
                }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                        healthStatus === 'healthy' ? 'bg-emerald-400' :
                        healthStatus === 'degraded' ? 'bg-amber-400' : 'bg-rose-400'
                    }`} />
                    {healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'degraded' ? 'Degraded' : 'Critical'}
                </div>
            </div>

            {/* Notices */}
            {notice && (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                    notice.tone === 'error'
                        ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                        : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                }`}>
                    {notice.tone === 'error' ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}
                    {notice.text}
                </div>
            )}
            {hasErrors && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertTriangle size={14} />
                    Some metrics failed to load. Check server logs.
                </div>
            )}

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: 'Total Users', value: fmt(usersCount), sub: `${fmt(proUsersCount)} pro · ${fmt(basicUsersCount)} basic`, icon: UsersRound, color: 'text-cyan-300' },
                    { label: 'Active (24h)', value: fmt(uniqueActiveUsers), sub: 'distinct users with chat', icon: Radio, color: 'text-emerald-300' },
                    { label: 'Messages (24h)', value: fmt(chats24hCount), sub: `${fmt(chatsCount)} total all time`, icon: TrendingUp, color: 'text-violet-300' },
                    { label: 'Avg Latency', value: `${fmt(avgLatencyMs)}ms`, sub: `${fmt(totalRouteCalls)} route calls`, icon: Activity, color: 'text-amber-300' },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                            <Icon size={13} className={color} />
                        </div>
                        <p className="text-2xl font-black text-slate-100">{value}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

                {/* LEFT: Cost control + route health */}
                <div className="space-y-4">

                    {/* Global override */}
                    <div className={`rounded-2xl border p-5 ${globalLowCostOverride ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Shield size={14} className={globalLowCostOverride ? 'text-amber-300' : 'text-slate-500'} />
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Cost Override</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                                globalLowCostOverride ? 'bg-amber-400/20 text-amber-200' : 'bg-white/[0.06] text-slate-500'
                            }`}>
                                {globalLowCostOverride ? 'ACTIVE' : 'OFF'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            {globalLowCostOverride
                                ? `Override is live. All requests use low-cost AI. Set by ${runtimeSettingsRow?.updated_by || 'system'}.`
                                : 'Normal operation. Toggle to force low-cost AI for all requests immediately.'}
                        </p>
                        <form action={setGlobalLowCostOverride}>
                            <input type="hidden" name="enabled" value={globalLowCostOverride ? 'false' : 'true'} />
                            <input type="hidden" name="returnTo" value="/admin/overview" />
                            <button
                                type="submit"
                                className={`w-full rounded-xl border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                                    globalLowCostOverride
                                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/18'
                                        : 'border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/18'
                                }`}
                            >
                                {globalLowCostOverride ? 'Disable Override' : 'Enable Override'}
                            </button>
                        </form>
                    </div>

                    {/* Route health */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Server size={13} className="text-slate-500" />
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Route Health (24h)</p>
                        </div>
                        <div className="space-y-2">
                            {[
                                { label: 'Calls', value: fmt(totalRouteCalls), accent: 'text-slate-100' },
                                { label: 'Capacity 429s', value: fmt(capacityBlocked), accent: capacityBlocked > 0 ? 'text-amber-300' : 'text-slate-100' },
                                { label: 'Hard 500s', value: fmt(hardFailures), accent: hardFailures > 0 ? 'text-rose-300' : 'text-slate-100' },
                                { label: 'Memories stored', value: fmt(memoriesCount), accent: 'text-slate-100' },
                                { label: 'Low-cost users', value: fmt(lowCostUsersCount), accent: 'text-slate-100' },
                            ].map(({ label, value, accent }) => (
                                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
                                    <span className="text-xs text-slate-500">{label}</span>
                                    <span className={`text-xs font-bold ${accent}`}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Source + provider mix */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={13} className="text-slate-500" />
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Traffic Mix (24h)</p>
                        </div>
                        <div className="space-y-2 mb-4">
                            {[
                                { label: 'User', value: sourceMix.user },
                                { label: 'Autonomous', value: sourceMix.autonomous },
                                { label: 'Idle', value: sourceMix.idle },
                            ].map(({ label, value }) => {
                                const total = sourceMix.user + sourceMix.autonomous + sourceMix.idle
                                const pct = total > 0 ? Math.round((value / total) * 100) : 0
                                return (
                                    <div key={label}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] text-slate-500">{label}</span>
                                            <span className="text-[11px] font-bold text-slate-300">{fmt(value)} <span className="text-slate-600">({pct}%)</span></span>
                                        </div>
                                        <div className="h-1 rounded-full bg-white/[0.06]">
                                            <div className="h-1 rounded-full bg-emerald-400/50" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">OpenRouter</span>
                                <span className="font-bold text-slate-300">{fmt(providerMix.openrouter)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Fallback</span>
                                <span className={`font-bold ${providerMix.fallback > 0 ? 'text-amber-300' : 'text-slate-300'}`}>{fmt(providerMix.fallback)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick ops */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={13} className="text-slate-500" />
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Bulk Operations</p>
                        </div>
                        <div className="space-y-2">
                            <form action={setAllUsersLowCostMode}>
                                <input type="hidden" name="returnTo" value="/admin/overview" />
                                <input type="hidden" name="enabled" value="true" />
                                <button type="submit" className="w-full rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300 hover:bg-emerald-400/12 transition-colors text-left">
                                    Enable Low-Cost For All Users
                                </button>
                            </form>
                            <form action={setAllUsersLowCostMode}>
                                <input type="hidden" name="returnTo" value="/admin/overview" />
                                <input type="hidden" name="enabled" value="false" />
                                <button type="submit" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors text-left">
                                    Disable Low-Cost For All Users
                                </button>
                            </form>
                            <form action={resetAllUserDailyUsage}>
                                <input type="hidden" name="returnTo" value="/admin/overview" />
                                <button type="submit" className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300 hover:bg-cyan-400/10 transition-colors text-left">
                                    Reset All Daily Counters
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Activity feeds — span 2 cols */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Recent chat feed */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock4 size={13} className="text-slate-500" />
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Recent Activity</p>
                        </div>
                        {recentChatRows && recentChatRows.length > 0 ? (
                            <div className="space-y-1">
                                {recentChatRows.slice(0, 15).map((row, i) => (
                                    <div key={`${row.user_id}-${row.created_at}-${i}`} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                                            {row.speaker.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-slate-300">{row.speaker}</span>
                                            <span className="text-xs text-slate-600 ml-2 font-mono">{(row.user_id || '').slice(0, 8)}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-600 shrink-0">{relativeTime(row.created_at)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600">No recent activity.</p>
                        )}
                    </div>

                    {/* Audit log */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield size={13} className="text-slate-500" />
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Audit Log</p>
                        </div>
                        {auditRows && auditRows.length > 0 ? (
                            <div className="space-y-1">
                                {auditRows.slice(0, 15).map((row, i) => (
                                    <div key={`${row.created_at}-${i}`} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-slate-200">{row.action.replace(/_/g, ' ')}</span>
                                            <span className="block text-[11px] text-slate-600 mt-0.5 truncate">{row.actor_email}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-600 shrink-0 mt-0.5">{relativeTime(row.created_at)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600">No audit actions recorded yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
