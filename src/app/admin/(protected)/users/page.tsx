import {
    clearUserChatHistory,
    resetAllUserDailyUsage,
    resetUserDailyUsage,
    setAllUsersLowCostMode,
    setUserLowCostMode,
    setUserSubscriptionTier,
    triggerWywaForUser,
} from '@/app/admin/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsersTable } from '@/components/admin/users-table'
import type { AdminUserRow } from '@/components/admin/user-drawer'
import { SubmitButton } from '@/components/admin/submit-button'
import { Search, CheckCircle2, CircleAlert, AlertTriangle, UsersRound, TrendingUp, Gauge, Zap } from 'lucide-react'

const PAGE_SIZE = 30

type AdminUsersPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ProfileRow = {
    id: string
    username: string | null
    subscription_tier: 'free' | 'basic' | 'pro' | null
    daily_msg_count: number | null
    last_msg_reset: string | null
    low_cost_mode: boolean | null
    created_at: string | null
    last_active_at: string | null
}

function fmt(n: number | null) { return new Intl.NumberFormat('en-US').format(n || 0) }

function sanitizeSearch(raw: string | undefined | string[]): string {
    const value = Array.isArray(raw) ? raw[0] : raw || ''
    return (value ?? '').replace(/[^a-zA-Z0-9 _@\-]/g, '').trim().slice(0, 100)
}

function buildUsersReturnTo(page: number, search: string) {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (search) params.set('search', search)
    const query = params.toString()
    return query ? `/admin/users?${query}` : '/admin/users'
}

function getNotice(errorCode: string | null, messageCode: string | null) {
    if (errorCode === 'invalid_request') return { tone: 'error', text: 'Request origin check failed.' }
    if (errorCode === 'bulk_reset_failed') return { tone: 'error', text: 'Could not reset daily usage.' }
    if (errorCode === 'bulk_low_cost_failed') return { tone: 'error', text: 'Could not update low-cost mode.' }
    if (errorCode === 'user_update_failed') return { tone: 'error', text: 'Could not update user. Try again.' }
    if (errorCode === 'user_history_delete_failed') return { tone: 'error', text: 'Could not delete history. Try again.' }
    if (messageCode === 'all_daily_reset_saved') return { tone: 'info', text: 'All daily counters reset.' }
    if (messageCode === 'all_low_cost_saved') return { tone: 'info', text: 'Low-cost mode updated for all users.' }
    if (messageCode === 'user_tier_saved') return { tone: 'info', text: 'Subscription tier updated.' }
    if (messageCode === 'user_low_cost_saved') return { tone: 'info', text: 'Low-cost mode updated.' }
    if (messageCode === 'user_daily_reset_saved') return { tone: 'info', text: 'Daily usage reset.' }
    if (messageCode === 'user_history_deleted') return { tone: 'info', text: 'Chat history deleted.' }
    return null
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
    const admin = createAdminClient()
    const params = await searchParams
    const errorCode = Array.isArray(params.error) ? params.error[0] : params.error || null
    const messageCode = Array.isArray(params.message) ? params.message[0] : params.message || null
    const notice = getNotice(errorCode, messageCode)
    const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page
    const currentPage = Math.max(1, parseInt(pageRaw || '1', 10) || 1)
    const search = sanitizeSearch(params.search)
    const usersReturnTo = buildUsersReturnTo(currentPage, search)
    const offset = (currentPage - 1) * PAGE_SIZE

    const since = new Date()
    since.setHours(since.getHours() - 24)
    const since24h = since.toISOString()

    let profilesQuery = admin
        .from('profiles')
        .select('id, username, subscription_tier, daily_msg_count, last_msg_reset, low_cost_mode, created_at, last_active_at', { count: 'exact' })
    if (search) {
        profilesQuery = profilesQuery.or(`username.ilike.%${search}%,id.ilike.${search}%`)
    }

    const { data: profileRows, error: profilesError, count: totalCount } = await profilesQuery
        .order('last_active_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

    const profiles = (profileRows || []) as ProfileRow[]
    const total = totalCount ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const userIds = profiles.map((p) => p.id)

    const [recent24hResult, totalMsgsResult] = await Promise.all([
        userIds.length > 0
            ? admin.from('chat_history').select('user_id').in('user_id', userIds).gte('created_at', since24h).limit(5000)
            : Promise.resolve({ data: [] as Array<{ user_id: string | null }>, error: null }),
        userIds.length > 0
            ? admin.from('chat_history').select('user_id').in('user_id', userIds).limit(10000)
            : Promise.resolve({ data: [] as Array<{ user_id: string | null }>, error: null }),
    ])

    const counts24h = new Map<string, number>()
    for (const row of recent24hResult.data || []) {
        if (row.user_id) counts24h.set(row.user_id, (counts24h.get(row.user_id) || 0) + 1)
    }
    const countsTotal = new Map<string, number>()
    for (const row of totalMsgsResult.data || []) {
        if (row.user_id) countsTotal.set(row.user_id, (countsTotal.get(row.user_id) || 0) + 1)
    }

    const users: AdminUserRow[] = profiles.map((p) => ({
        ...p,
        msgs24h: counts24h.get(p.id) || 0,
        msgsTotal: countsTotal.get(p.id) || 0,
    }))

    // Summary stats
    const proCount = profiles.filter((p) => p.subscription_tier === 'pro').length
    const basicCount = profiles.filter((p) => p.subscription_tier === 'basic').length
    const lowCostCount = profiles.filter((p) => !!p.low_cost_mode).length
    const total24hMsgs = Array.from(counts24h.values()).reduce((s, v) => s + v, 0)
    const hasErrors = !!profilesError || !!recent24hResult.error || !!totalMsgsResult.error

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Users</p>
                <h1 className="mt-1 text-2xl font-black text-slate-100">User Management</h1>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: 'Total Users', value: fmt(total), sub: search ? 'filtered' : 'all accounts', icon: UsersRound, color: 'text-cyan-300' },
                    { label: 'Pro / Basic', value: `${fmt(proCount)} / ${fmt(basicCount)}`, sub: 'paid subscribers', icon: Zap, color: 'text-emerald-300' },
                    { label: 'Messages (24h)', value: fmt(total24hMsgs), sub: 'across all users', icon: TrendingUp, color: 'text-violet-300' },
                    { label: 'Low-Cost Users', value: fmt(lowCostCount), sub: 'on this page', icon: Gauge, color: 'text-amber-300' },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                            <Icon size={13} className={color} />
                        </div>
                        <p className="text-xl font-black text-slate-100">{value}</p>
                        <p className="mt-1 text-[11px] text-slate-600">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Bulk ops */}
            <div className="flex flex-wrap gap-2">
                <form action={setAllUsersLowCostMode}>
                    <input type="hidden" name="returnTo" value={usersReturnTo} />
                    <input type="hidden" name="enabled" value="true" />
                    <SubmitButton className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 hover:bg-emerald-400/12 transition-all" pendingText="Enabling…">
                        Enable Low-Cost All
                    </SubmitButton>
                </form>
                <form action={setAllUsersLowCostMode}>
                    <input type="hidden" name="returnTo" value={usersReturnTo} />
                    <input type="hidden" name="enabled" value="false" />
                    <SubmitButton className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all" pendingText="Disabling…">
                        Disable Low-Cost All
                    </SubmitButton>
                </form>
                <form action={resetAllUserDailyUsage}>
                    <input type="hidden" name="returnTo" value={usersReturnTo} />
                    <SubmitButton className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/10 transition-all" pendingText="Resetting…">
                        Reset All Daily Counters
                    </SubmitButton>
                </form>
            </div>

            {/* Search */}
            <form method="GET" action="/admin/users" className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                        type="text"
                        name="search"
                        defaultValue={search}
                        placeholder="Username or user ID…"
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
                    />
                </div>
                <button type="submit" className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-white/[0.09] transition-colors">
                    Search
                </button>
                {search && (
                    <a href="/admin/users" className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
                        Clear
                    </a>
                )}
            </form>

            {/* Notices */}
            {notice && (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                    notice.tone === 'error' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                }`}>
                    {notice.tone === 'error' ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}
                    {notice.text}
                </div>
            )}
            {hasErrors && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertTriangle size={14} />
                    Some metrics failed to load. Controls still work.
                </div>
            )}

            {/* Hint */}
            <p className="text-[11px] text-slate-600">Click any row to manage that user.</p>

            {/* Table */}
            <UsersTable
                users={users}
                usersReturnTo={usersReturnTo}
                setTierAction={setUserSubscriptionTier}
                setLowCostAction={setUserLowCostMode}
                resetDailyAction={resetUserDailyUsage}
                deleteChatAction={clearUserChatHistory}
                wywaAction={triggerWywaForUser}
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <p className="text-xs text-slate-500">
                        Page {currentPage} of {totalPages} ({fmt(total)} users)
                    </p>
                    <div className="flex items-center gap-2">
                        {currentPage > 1 ? (
                            <a href={`/admin/users?page=${currentPage - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] transition-colors">
                                ← Prev
                            </a>
                        ) : (
                            <span className="rounded-lg border border-white/[0.04] px-3 py-1.5 text-[11px] text-slate-700">← Prev</span>
                        )}
                        {currentPage < totalPages ? (
                            <a href={`/admin/users?page=${currentPage + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] transition-colors">
                                Next →
                            </a>
                        ) : (
                            <span className="rounded-lg border border-white/[0.04] px-3 py-1.5 text-[11px] text-slate-700">Next →</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
