'use client'

import { useState, useTransition } from 'react'
import { X, Crown, Gauge, Trash2, Zap, RotateCcw, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WywaResult } from '@/lib/ai/wywa'
import { TIER_LIMITS } from '@/lib/billing'

export type AdminUserRow = {
    id: string
    username: string | null
    subscription_tier: 'free' | 'basic' | 'pro' | null
    daily_msg_count: number | null
    last_msg_reset: string | null
    low_cost_mode: boolean | null
    created_at: string | null
    last_active_at: string | null
    msgs24h: number
    msgsTotal: number
}

type UserDrawerProps = {
    user: AdminUserRow | null
    onClose: () => void
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

const TIER_COLORS = {
    free: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
    basic: 'bg-blue-400/10 text-blue-300 border-blue-400/25',
    pro: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
}

export function UserDrawer({ user, onClose, usersReturnTo, setTierAction, setLowCostAction, resetDailyAction, deleteChatAction, wywaAction }: UserDrawerProps) {
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [wywaState, setWywaState] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle')
    const [wywaResult, setWywaResult] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    if (!user) return null

    const tier = user.subscription_tier || 'free'
    const isPaid = tier === 'basic' || tier === 'pro'
    const dailyLimit = TIER_LIMITS[tier].messagesPerWindow
    const dailyCount = user.daily_msg_count || 0
    const usagePct = dailyLimit ? Math.min(100, Math.round((dailyCount / dailyLimit) * 100)) : 0
    const initials = (user.username || user.id).slice(0, 2).toUpperCase()

    async function handleWywa() {
        setWywaState('running')
        setWywaResult(null)
        try {
            const fd = new FormData()
            fd.set('userId', user!.id)
            const res = await wywaAction(fd)
            setWywaResult(res.status === 'generated'
                ? `Generated ${res.messagesWritten} messages`
                : res.status === 'error' ? `Error: ${'message' in res ? res.message : 'unknown'}` : res.status.replace(/_/g, ' '))
        } catch (e) {
            setWywaResult(`Failed: ${e instanceof Error ? e.message : 'unknown'}`)
        } finally {
            setWywaState('done')
            setTimeout(() => { setWywaState('idle'); setWywaResult(null) }, 5000)
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md flex flex-col border-l border-white/[0.1] bg-[#0b0f1a] shadow-2xl overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] sticky top-0 bg-[#0b0f1a] z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] text-sm font-black text-slate-300">
                            {initials}
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-100">{user.username || 'Unnamed'}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{user.id.slice(0, 16)}…</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 px-5 py-5 space-y-5">
                    {/* Tier badge + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider', TIER_COLORS[tier])}>
                            {tier === 'pro' && <Crown size={10} className="inline mr-1" />}{tier}
                        </span>
                        {user.low_cost_mode && (
                            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                                Low-Cost
                            </span>
                        )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Messages (24h)', value: fmt(user.msgs24h) },
                            { label: 'Messages (total)', value: fmt(user.msgsTotal) },
                            { label: 'Last Active', value: relTime(user.last_active_at) },
                            { label: 'Joined', value: relTime(user.created_at) },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">{label}</p>
                                <p className="mt-1 text-sm font-bold text-slate-200">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Daily usage bar */}
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600">Daily Usage</p>
                            <p className="text-[11px] font-bold text-slate-400">
                                {fmt(dailyCount)} {dailyLimit ? `/ ${fmt(dailyLimit)}` : '(unlimited)'}
                            </p>
                        </div>
                        {dailyLimit ? (
                            <div className="h-1.5 rounded-full bg-white/[0.07]">
                                <div
                                    className={cn('h-1.5 rounded-full transition-all', usagePct > 80 ? 'bg-rose-400' : usagePct > 50 ? 'bg-amber-400' : 'bg-emerald-400')}
                                    style={{ width: `${usagePct}%` }}
                                />
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-600">Pro — no daily cap</p>
                        )}
                        {user.last_msg_reset && (
                            <p className="mt-1.5 text-[11px] text-slate-600">Reset {relTime(user.last_msg_reset)}</p>
                        )}
                    </div>

                    {/* Tier control */}
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-4">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-3">Subscription Tier</p>
                        <form action={setTierAction} className="flex gap-2">
                            <input type="hidden" name="returnTo" value={usersReturnTo} />
                            <input type="hidden" name="userId" value={user.id} />
                            <select
                                name="subscriptionTier"
                                defaultValue={tier}
                                className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400/40"
                            >
                                <option value="free">Free</option>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                            </select>
                            <button
                                type="submit"
                                className="rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-400/14 transition-colors"
                            >
                                Set
                            </button>
                        </form>
                    </div>

                    {/* Low-cost toggle */}
                    <form action={setLowCostAction}>
                        <input type="hidden" name="returnTo" value={usersReturnTo} />
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="enabled" value={user.low_cost_mode ? 'false' : 'true'} />
                        <button
                            type="submit"
                            className={cn(
                                'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors',
                                user.low_cost_mode
                                    ? 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300 hover:bg-amber-400/12'
                                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                            )}
                        >
                            <span>Low-Cost Mode</span>
                            <span className={cn('text-[10px] font-black uppercase tracking-widest', user.low_cost_mode ? 'text-amber-300' : 'text-slate-600')}>
                                {user.low_cost_mode ? 'ON — Click to disable' : 'OFF — Click to enable'}
                            </span>
                        </button>
                    </form>

                    {/* Reset daily */}
                    <form action={resetDailyAction}>
                        <input type="hidden" name="returnTo" value={usersReturnTo} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                            type="submit"
                            className="w-full flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
                        >
                            <span>Reset Daily Counter</span>
                            <RotateCcw size={14} />
                        </button>
                    </form>

                    {/* WYWA (paid only) */}
                    {isPaid && (
                        <div>
                            {wywaState === 'idle' && (
                                <button
                                    type="button"
                                    onClick={() => setWywaState('confirming')}
                                    className="w-full flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-400/10 transition-colors"
                                >
                                    <span>Trigger WYWA</span>
                                    <Zap size={14} />
                                </button>
                            )}
                            {wywaState === 'confirming' && (
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleWywa} className="flex-1 rounded-xl border border-violet-400/30 bg-violet-400/15 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-400/22 transition-colors">Confirm</button>
                                    <button type="button" onClick={() => setWywaState('idle')} className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:bg-white/[0.08] transition-colors">Cancel</button>
                                </div>
                            )}
                            {wywaState === 'running' && (
                                <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 text-sm text-violet-400 text-center">Running WYWA…</div>
                            )}
                            {wywaState === 'done' && wywaResult && (
                                <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 text-sm text-violet-300 text-center">{wywaResult}</div>
                            )}
                        </div>
                    )}

                    {/* Danger zone */}
                    <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.04] px-4 py-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-rose-500 mb-3">Danger Zone</p>
                        {!deleteConfirm ? (
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(true)}
                                className="w-full flex items-center justify-between rounded-lg border border-rose-400/20 bg-rose-400/[0.07] px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/14 transition-colors"
                            >
                                <span>Delete Chat History</span>
                                <Trash2 size={14} />
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-rose-300/80">This permanently deletes all chat history for this user. Cannot be undone.</p>
                                <form action={deleteChatAction} className="flex gap-2">
                                    <input type="hidden" name="returnTo" value={usersReturnTo} />
                                    <input type="hidden" name="userId" value={user.id} />
                                    <button type="submit" className="flex-1 rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/30 transition-colors">
                                        Confirm Delete
                                    </button>
                                    <button type="button" onClick={() => setDeleteConfirm(false)} className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:bg-white/[0.08] transition-colors">
                                        Cancel
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
