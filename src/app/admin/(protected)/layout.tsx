import Link from 'next/link'
import { adminSignOut } from '@/app/admin/actions'
import { requireAdminSession } from '@/lib/admin/session'
import { LayoutDashboard, UsersRound, LogOut, ShieldCheck, Zap } from 'lucide-react'
import { AdminNavLinks } from '@/components/admin/admin-nav-links'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
    const session = await requireAdminSession()

    return (
        <div className="admin-shell relative min-h-dvh bg-[#06090f] text-foreground flex">
            {/* Ambient background */}
            <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(29,78,216,0.18),transparent_40%),radial-gradient(ellipse_at_100%_5%,rgba(16,185,129,0.12),transparent_40%)]" />

            {/* Sidebar */}
            <aside className="relative z-20 hidden lg:flex w-56 shrink-0 flex-col border-r border-white/[0.08] bg-[rgba(7,12,20,0.85)] backdrop-blur-xl">
                {/* Logo */}
                <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 border border-emerald-400/25">
                            <Zap size={13} className="text-emerald-300" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400/80 leading-none">MyGang</p>
                            <p className="text-[11px] font-black text-slate-100 leading-tight mt-0.5">Control Room</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    <AdminNavLinks />
                </nav>

                {/* Footer */}
                <div className="px-3 py-4 border-t border-white/[0.07] space-y-2">
                    <div className="px-3 py-2">
                        <p className="text-[10px] text-slate-500 truncate">{session.email}</p>
                    </div>
                    <form action={adminSignOut}>
                        <button
                            type="submit"
                            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
                        >
                            <LogOut size={13} />
                            Sign Out
                        </button>
                    </form>
                </div>
            </aside>

            {/* Mobile header */}
            <div className="lg:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[rgba(7,12,20,0.88)] backdrop-blur-xl px-4 h-14">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400/15 border border-emerald-400/25">
                        <Zap size={11} className="text-emerald-300" />
                    </div>
                    <span className="text-sm font-black text-slate-100">Control Room</span>
                </div>
                <div className="flex items-center gap-1">
                    <Link href="/admin/overview" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                        <LayoutDashboard size={12} /> Overview
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                        <UsersRound size={12} /> Users
                    </Link>
                    <form action={adminSignOut}>
                        <button type="submit" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                            <LogOut size={12} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Main content */}
            <main className="relative z-10 flex-1 min-w-0 lg:overflow-auto">
                <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8 pt-20 lg:pt-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
