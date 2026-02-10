import { createAdminClient } from '@/lib/supabase/admin'

function formatNumber(value: number | null) {
    return new Intl.NumberFormat('en-US').format(value || 0)
}

export default async function AdminOverviewPage() {
    const admin = createAdminClient()
    const since = new Date()
    since.setHours(since.getHours() - 24)
    const since24h = since.toISOString()

    const [
        { count: usersCount, error: usersError },
        { count: chatsCount, error: chatsError },
        { count: chats24hCount, error: chats24hError },
        { count: memoriesCount, error: memoriesError },
        { data: recentChatRows, error: recentChatError },
    ] = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
        admin.from('memories').select('*', { count: 'exact', head: true }),
        admin.from('chat_history').select('user_id, speaker, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    const hasAnyError = !!(usersError || chatsError || chats24hError || memoriesError || recentChatError)

    return (
        <section className="space-y-4">
            <div>
                <h1 className="text-2xl font-black">Overview</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Initial admin read-only metrics.
                </p>
            </div>

            {hasAnyError && (
                <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    Some metrics could not be loaded completely. Check server logs for query details.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Users</p>
                    <p className="text-xl font-black mt-1">{formatNumber(usersCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chat Rows</p>
                    <p className="text-xl font-black mt-1">{formatNumber(chatsCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Chat Rows (24h)</p>
                    <p className="text-xl font-black mt-1">{formatNumber(chats24hCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Memories</p>
                    <p className="text-xl font-black mt-1">{formatNumber(memoriesCount)}</p>
                </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Recent Chat Activity</p>
                {recentChatRows && recentChatRows.length > 0 ? (
                    <div className="space-y-1">
                        {recentChatRows.map((row, index) => (
                            <div key={`${row.user_id}-${row.created_at}-${index}`} className="text-xs text-muted-foreground">
                                <span className="text-foreground font-medium">{row.speaker}</span>
                                {' '}| user {row.user_id.slice(0, 8)}...
                                {' '}| {new Date(row.created_at).toLocaleString()}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">No recent rows available.</p>
                )}
            </div>
        </section>
    )
}
