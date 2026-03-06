import packageJson from '../../../package.json'

export const dynamic = 'force-dynamic'

export default function StatusPage() {
    const now = new Date()

    return (
        <main className="min-h-dvh bg-background text-foreground px-6 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
                    <h1 className="text-3xl font-black">MyGang Health Check</h1>
                </div>

                <div className="grid gap-4">
                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Health</div>
                        <div className="mt-2 text-lg font-semibold text-emerald-400">All systems operational</div>
                        <div className="text-xs text-muted-foreground mt-1 break-all">Server time: {now.toISOString()}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Version</div>
                        <div className="mt-2 text-lg font-semibold">{packageJson.version}</div>
                    </div>
                </div>
            </div>
        </main>
    )
}
