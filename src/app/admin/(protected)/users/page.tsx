import {
    clearUserChatHistory,
    resetAllUserDailyUsage,
    resetUserDailyUsage,
    setAllUsersLowCostMode,
    setUserLowCostMode,
    setUserSubscriptionTier,
} from '@/app/admin/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { Gauge, Shield, DatabaseZap, AlertTriangle, UsersRound } from 'lucide-react'

type AdminUsersPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ProfileRow = {
    id: string
    username: string | null
    subscription_tier: 'free' | 'pro' | null
    daily_msg_count: number | null
    last_msg_reset: string | null
    low_cost_mode: boolean | null
    created_at: string | null
    last_active_at: string | null
}

function formatNumber(value: number | null) {
    return new Intl.NumberFormat('en-US').format(value || 0)
}

function formatTime(value: string | null) {
    if (!value) return 'Unknown'
    return new Date(value).toLocaleString()
}

function getNotice(errorCode: string | null, messageCode: string | null) {
    if (errorCode === 'invalid_request') {
        return { tone: 'error', text: 'Request origin check failed. Retry from the admin panel directly.' }
    }
    if (errorCode === 'bulk_reset_failed') {
        return { tone: 'error', text: 'Could not reset daily usage for all users. Check server logs.' }
    }
    if (errorCode === 'bulk_low_cost_failed') {
        return { tone: 'error', text: 'Could not update low-cost mode for all users. Check server logs.' }
    }
    if (errorCode === 'user_update_failed') {
        return { tone: 'error', text: 'Could not update user settings. Try again.' }
    }
    if (errorCode === 'user_history_delete_failed') {
        return { tone: 'error', text: 'Could not clear user chat history. Try again.' }
    }
    if (messageCode === 'all_daily_reset_saved') {
        return { tone: 'info', text: 'All user daily usage counters were reset.' }
    }
    if (messageCode === 'all_low_cost_saved') {
        return { tone: 'info', text: 'Low-cost mode was updated for all users.' }
    }
    if (messageCode === 'user_tier_saved') {
        return { tone: 'info', text: 'User subscription tier updated.' }
    }
    if (messageCode === 'user_low_cost_saved') {
        return { tone: 'info', text: 'User low-cost mode updated.' }
    }
    if (messageCode === 'user_daily_reset_saved') {
        return { tone: 'info', text: 'User daily usage reset.' }
    }
    if (messageCode === 'user_history_deleted') {
        return { tone: 'info', text: 'User chat history deleted.' }
    }
    return null
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
    const admin = createAdminClient()
    const params = await searchParams
    const errorCodeRaw = params.error
    const messageCodeRaw = params.message
    const errorCode = Array.isArray(errorCodeRaw) ? errorCodeRaw[0] : errorCodeRaw || null
    const messageCode = Array.isArray(messageCodeRaw) ? messageCodeRaw[0] : messageCodeRaw || null
    const notice = getNotice(errorCode, messageCode)

    const since = new Date()
    since.setHours(since.getHours() - 24)
    const since24h = since.toISOString()

    const { data: profileRows, error: profilesError } = await admin
        .from('profiles')
        .select('id, username, subscription_tier, daily_msg_count, last_msg_reset, low_cost_mode, created_at, last_active_at')
        .order('last_active_at', { ascending: false })
        .limit(40)
    const profiles = (profileRows || []) as ProfileRow[]
    const userIds = profiles.map((profile) => profile.id)

    const [recentRowsResult, totalCountsResult] = await Promise.all([
        userIds.length > 0
            ? admin
                .from('chat_history')
                .select('user_id')
                .in('user_id', userIds)
                .gte('created_at', since24h)
                .limit(5000)
            : Promise.resolve({ data: [], error: null } as { data: Array<{ user_id: string | null }>; error: null }),
        userIds.length > 0
            ? Promise.all(
                userIds.map(async (userId) => {
                    const { count, error } = await admin
                        .from('chat_history')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userId)
                    return { userId, count: count || 0, error }
                })
            )
            : Promise.resolve([] as Array<{ userId: string; count: number; error: unknown }>),
    ])

    const counts24hByUser = new Map<string, number>()
    for (const row of recentRowsResult.data || []) {
        const userId = row.user_id
        if (!userId) continue
        counts24hByUser.set(userId, (counts24hByUser.get(userId) || 0) + 1)
    }

    const totalCountsByUser = new Map<string, number>()
    let totalCountErrors = 0
    for (const row of totalCountsResult) {
        totalCountsByUser.set(row.userId, row.count)
        if (row.error) totalCountErrors += 1
    }

    const activeLowCostUsers = profiles.filter((profile) => !!profile.low_cost_mode).length
    const proUsers = profiles.filter((profile) => profile.subscription_tier === 'pro').length
    const totalDailyUsage = profiles.reduce((sum, profile) => sum + (profile.daily_msg_count || 0), 0)
    const totalRecent24hMessages = Array.from(counts24hByUser.values()).reduce((sum, value) => sum + value, 0)
    const hasAnyError = !!profilesError || !!recentRowsResult.error || totalCountErrors > 0

    return (
        <section className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300/70">Admin Users</p>
                    <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">User Controls & Risk Operations</h1>
                    <p className="mt-1 text-sm text-slate-300/80">
                        Manage tiers, quota state, and chat history at account level.
                    </p>
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
                    Some user metrics could not be fully loaded. Controls remain available.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Loaded Users</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(profiles.length)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Pro Users</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(proUsers)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Low-Cost Enabled</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(activeLowCostUsers)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">Messages (24h)</p>
                    <p className="mt-1 text-2xl font-black text-slate-100">{formatNumber(totalRecent24hMessages)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <UsersRound size={14} className="text-cyan-300" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">Bulk Controls</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={resetAllUserDailyUsage}>
                            <input type="hidden" name="returnTo" value="/admin/users" />
                            <button
                                type="submit"
                                className="flex h-full w-full items-center justify-between gap-2 rounded-xl border border-blue-300/30 bg-blue-400/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100 transition-colors hover:bg-blue-400/16"
                            >
                                <span>Reset Daily Usage</span>
                                <Gauge size={13} />
                            </button>
                        </form>
                        <form action={setAllUsersLowCostMode}>
                            <input type="hidden" name="returnTo" value="/admin/users" />
                            <input type="hidden" name="enabled" value="true" />
                            <button
                                type="submit"
                                className="flex h-full w-full items-center justify-between gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-400/16"
                            >
                                <span>Enable Low-Cost For All</span>
                                <Shield size={13} />
                            </button>
                        </form>
                        <form action={setAllUsersLowCostMode}>
                            <input type="hidden" name="returnTo" value="/admin/users" />
                            <input type="hidden" name="enabled" value="false" />
                            <button
                                type="submit"
                                className="flex h-full w-full items-center justify-between gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-100 transition-colors hover:bg-fuchsia-400/16"
                            >
                                <span>Disable Low-Cost For All</span>
                                <DatabaseZap size={13} />
                            </button>
                        </form>
                        <div className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-3 text-[11px] text-amber-100">
                            <p className="font-semibold uppercase tracking-[0.14em]">Impact Check</p>
                            <p className="mt-1 leading-relaxed text-amber-100/90">
                                Daily counters loaded: {formatNumber(totalDailyUsage)} total. Verify business intent before bulk operations.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-100" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">Destructive Operations</p>
                    </div>
                    <p className="text-xs leading-relaxed text-amber-100/90">
                        Per-user &quot;Delete Chat History&quot; removes all timeline rows for that account. This cannot be undone.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-amber-100/90">
                        Bulk actions in this panel intentionally avoid deletion. Only quota and low-cost flags are bulk-editable.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {profiles.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300/85">
                        No users found.
                    </div>
                )}
                {profiles.map((profile) => {
                    const displayName = profile.username || `${profile.id.slice(0, 8)}...`
                    const tier = profile.subscription_tier || 'free'
                    const lowCostEnabled = !!profile.low_cost_mode
                    const dailyCount = profile.daily_msg_count || 0
                    const recent24h = counts24hByUser.get(profile.id) || 0
                    const totalCount = totalCountsByUser.get(profile.id) || 0
                    return (
                        <article key={profile.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-100">{displayName}</p>
                                    <p className="mt-1 break-all font-mono text-[11px] text-slate-300/75">{profile.id}</p>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300/90 sm:grid-cols-4">
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Tier</p>
                                            <p className="mt-0.5 font-semibold text-slate-100">{tier}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Daily Count</p>
                                            <p className="mt-0.5 font-semibold text-slate-100">{formatNumber(dailyCount)}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Messages 24h</p>
                                            <p className="mt-0.5 font-semibold text-slate-100">{formatNumber(recent24h)}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Messages Total</p>
                                            <p className="mt-0.5 font-semibold text-slate-100">{formatNumber(totalCount)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300/80">
                                        <span>Low-Cost: {lowCostEnabled ? 'ON' : 'OFF'}</span>
                                        <span>Last Reset: {formatTime(profile.last_msg_reset)}</span>
                                        <span>Last Active: {formatTime(profile.last_active_at)}</span>
                                        <span>Created: {formatTime(profile.created_at)}</span>
                                    </div>
                                </div>

                                <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:w-[360px] sm:grid-cols-2">
                                    <form action={setUserSubscriptionTier}>
                                        <input type="hidden" name="returnTo" value="/admin/users" />
                                        <input type="hidden" name="userId" value={profile.id} />
                                        <input type="hidden" name="subscriptionTier" value={tier === 'pro' ? 'free' : 'pro'} />
                                        <button
                                            type="submit"
                                            className="w-full rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-400/16"
                                        >
                                            Set Tier: {tier === 'pro' ? 'Free' : 'Pro'}
                                        </button>
                                    </form>
                                    <form action={setUserLowCostMode}>
                                        <input type="hidden" name="returnTo" value="/admin/users" />
                                        <input type="hidden" name="userId" value={profile.id} />
                                        <input type="hidden" name="enabled" value={lowCostEnabled ? 'false' : 'true'} />
                                        <button
                                            type="submit"
                                            className="w-full rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-400/16"
                                        >
                                            Low-Cost: {lowCostEnabled ? 'Disable' : 'Enable'}
                                        </button>
                                    </form>
                                    <form action={resetUserDailyUsage}>
                                        <input type="hidden" name="returnTo" value="/admin/users" />
                                        <input type="hidden" name="userId" value={profile.id} />
                                        <button
                                            type="submit"
                                            className="w-full rounded-xl border border-blue-300/30 bg-blue-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100 transition-colors hover:bg-blue-400/16"
                                        >
                                            Reset Daily Usage
                                        </button>
                                    </form>
                                    <form action={clearUserChatHistory}>
                                        <input type="hidden" name="returnTo" value="/admin/users" />
                                        <input type="hidden" name="userId" value={profile.id} />
                                        <button
                                            type="submit"
                                            className="w-full rounded-xl border border-rose-300/30 bg-rose-500/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100 transition-colors hover:bg-rose-500/20"
                                        >
                                            Delete Chat History
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}
