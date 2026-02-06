import packageJson from '../../../package.json'

export const dynamic = 'force-dynamic'

export default function StatusPage() {
    const now = new Date()
    const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    const environment = process.env.VERCEL_ENV || process.env.NODE_ENV
    const region = process.env.VERCEL_REGION

    return (
        <main className="min-h-dvh bg-background text-foreground px-6 py-10">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
                    <h1 className="text-3xl font-black">MyGang Health Check</h1>
                </div>

                <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Health</div>
                        <div className="mt-2 text-lg font-semibold text-emerald-400">OK</div>
                        <div className="text-xs text-muted-foreground mt-1">Server time: {now.toISOString()}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Version</div>
                        <div className="mt-2 text-lg font-semibold">{packageJson.version}</div>
                        <div className="text-xs text-muted-foreground mt-1">Commit: {commit || 'local'}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">Environment</div>
                        <div className="mt-2 text-lg font-semibold">{environment || 'unknown'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Region: {region || 'local'}</div>
                    </div>
                </div>
            </div>
        </main>
    )
}
