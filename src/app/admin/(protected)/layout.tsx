import Link from 'next/link'
import { adminSignOut } from '@/app/admin/actions'
import { requireAdminSession } from '@/lib/admin/session'
import { LayoutDashboard, UsersRound, LogOut, ShieldCheck } from 'lucide-react'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
    const session = await requireAdminSession()

    return (
        <main className="relative min-h-dvh overflow-hidden bg-[#06090f] text-foreground">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(29,78,216,0.24),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.12),transparent_50%)]" />
            <div className="relative z-10">
                <header className="border-b border-white/10 bg-[rgba(7,12,20,0.74)] backdrop-blur-xl">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-300/75">Admin Panel</p>
                                <p className="text-sm font-black text-slate-100">MyGang Control Room</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                                <ShieldCheck size={12} />
                                Signed in as {session.email}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href="/admin/overview"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100 transition-colors hover:bg-white/[0.09]"
                            >
                                <LayoutDashboard size={13} />
                                Overview
                            </Link>
                            <Link
                                href="/admin/users"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100 transition-colors hover:bg-white/[0.09]"
                            >
                                <UsersRound size={13} />
                                Users
                            </Link>
                            <form action={adminSignOut} className="ml-auto">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100 transition-colors hover:bg-amber-300/18"
                                >
                                    <LogOut size={13} />
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </header>
                <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    {children}
                </div>
            </div>
        </main>
    )
}
