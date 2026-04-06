'use client'

import { useState } from 'react'
import { ChevronRight, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserDrawer, type AdminUserRow } from '@/components/admin/user-drawer'
import type { WywaResult } from '@/lib/ai/wywa'
import { TIER_LIMITS } from '@/lib/billing'

type UsersTableProps = {
    users: AdminUserRow[]
    usersReturnTo: string
    setTierAction: (fd: FormData) => Promise<void>
    setLowCostAction: (fd: FormData) => Promise<void>
    resetDailyAction: (fd: FormData) => Promise<void>
    deleteChatAction: (fd: FormData) => Promise<void>
    wywaAction: (fd: FormData) => Promise<WywaResult>
}

function fmt(n: number) { return new Intl.NumberFormat('en-US').format(n) }

function relTime(iso: string | null) {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
}

const TIER_PILL = {
    free: 'bg-slate-400/10 text-slate-500 border-slate-400/15',
    basic: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
    pro: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
}

export function UsersTable({ users, usersReturnTo, setTierAction, setLowCostAction, resetDailyAction, deleteChatAction, wywaAction }: UsersTableProps) {
    const [selected, setSelected] = useState<AdminUserRow | null>(null)

    return (
        <>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_90px_90px_32px] gap-3 px-4 py-2.5 border-b border-white/[0.07] bg-white/[0.02]">
                    {['User', 'Tier', 'Today', 'Total', 'Last Active', 'Low-Cost', ''].map((h) => (
                        <p key={h} className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{h}</p>
                    ))}
                </div>

                {users.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-600">No users found.</div>
                )}

                {users.map((user) => {
                    const tier = user.subscription_tier || 'free'
                    const dailyLimit = TIER_LIMITS[tier].messagesPerWindow
                    const dailyCount = user.daily_msg_count || 0
                    const usagePct = dailyLimit ? Math.min(100, Math.round((dailyCount / dailyLimit) * 100)) : 0

                    return (
                        <button
                            key={user.id}
                            type="button"
                            onClick={() => setSelected(user)}
                            className="w-full text-left border-b border-white/[0.05] last:border-0 px-4 py-3 hover:bg-white/[0.04] transition-colors group"
                        >
                            {/* Mobile layout */}
                            <div className="md:hidden flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-black text-slate-400">
                                    {(user.username || user.id).slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-200 truncate">{user.username || user.id.slice(0, 10) + '…'}</span>
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', TIER_PILL[tier])}>
                                            {tier === 'pro' ? <Crown size={9} className="inline mr-0.5" /> : null}{tier}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5">{relTime(user.last_active_at)} · {fmt(user.msgs24h)} today · {fmt(user.msgsTotal)} total</p>
                                </div>
                                <ChevronRight size={14} className="text-slate-600 shrink-0 group-hover:text-slate-400 transition-colors" />
                            </div>

                            {/* Desktop layout */}
                            <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_90px_90px_32px] gap-3 items-center">
                                {/* User */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-black text-slate-400">
                                        {(user.username || user.id).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-200 truncate">{user.username || <span className="font-mono text-slate-500">{user.id.slice(0, 10)}…</span>}</p>
                                        <div className="w-24 h-1 rounded-full bg-white/[0.06] mt-1">
                                            {dailyLimit && (
                                                <div
                                                    className={cn('h-1 rounded-full', usagePct > 80 ? 'bg-rose-400/60' : usagePct > 50 ? 'bg-amber-400/60' : 'bg-emerald-400/40')}
                                                    style={{ width: `${usagePct}%` }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Tier */}
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase w-fit', TIER_PILL[tier])}>
                                    {tier}
                                </span>

                                {/* Today */}
                                <span className="text-sm font-semibold text-slate-300">{fmt(user.msgs24h)}</span>

                                {/* Total */}
                                <span className="text-sm text-slate-500">{fmt(user.msgsTotal)}</span>

                                {/* Last active */}
                                <span className="text-[11px] text-slate-500">{relTime(user.last_active_at)}</span>

                                {/* Low-cost */}
                                <span className={cn('text-[10px] font-bold uppercase', user.low_cost_mode ? 'text-amber-400' : 'text-slate-700')}>
                                    {user.low_cost_mode ? 'ON' : '—'}
                                </span>

                                {/* Arrow */}
                                <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                            </div>
                        </button>
                    )
                })}
            </div>

            {selected && (
                <UserDrawer
                    user={selected}
                    onClose={() => setSelected(null)}
                    usersReturnTo={usersReturnTo}
                    setTierAction={setTierAction}
                    setLowCostAction={setLowCostAction}
                    resetDailyAction={resetDailyAction}
                    deleteChatAction={deleteChatAction}
                    wywaAction={wywaAction}
                />
            )}
        </>
    )
}
