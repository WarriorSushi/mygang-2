import Link from 'next/link'
import { adminSignOut } from '@/app/admin/actions'
import { requireAdminSession } from '@/lib/admin/session'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
    const session = await requireAdminSession()

    return (
        <main className="min-h-dvh bg-background text-foreground">
            <header className="border-b border-border/70 bg-card/80 backdrop-blur-xl">
                <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Admin Panel</p>
                        <p className="text-sm font-black">MyGang Control Room</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/overview"
                            className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Overview
                        </Link>
                        <form action={adminSignOut}>
                            <button
                                type="submit"
                                className="rounded-md border border-border/70 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </header>
            <div className="mx-auto w-full max-w-6xl px-4 py-6">
                <div className="mb-4 rounded-lg border border-border/70 bg-card/50 px-3 py-2 text-[11px] text-muted-foreground">
                    Signed in as <span className="font-semibold text-foreground">{session.email}</span>
                </div>
                {children}
            </div>
        </main>
    )
}
