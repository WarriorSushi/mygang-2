import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPanel } from '@/components/settings/settings-panel'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('username, theme, subscription_tier')
        .eq('id', user.id)
        .single()

    return (
        <main id="main-content" className="min-h-dvh bg-background text-foreground px-4 sm:px-6 lg:px-10 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Settings</div>
                        <h1 className="text-3xl sm:text-4xl font-black">Your Control Center</h1>
                    </div>
                    <Link
                        href="/chat"
                        className="text-[10px] uppercase tracking-widest border border-border/50 rounded-full px-4 py-2 hover:bg-muted/60 w-fit"
                    >
                        Back to Chat
                    </Link>
                </div>

                <SettingsPanel
                    username={profile?.username ?? null}
                    email={user.email ?? null}
                    initialSettings={{
                        theme: (profile?.theme as 'light' | 'dark') || 'dark',
                    }}
                    usage={{
                        subscriptionTier: profile?.subscription_tier ?? 'free'
                    }}
                />

                <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Legal & Info</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link href="/about" className="rounded-full border border-border/50 px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-muted/60 transition-colors">About</Link>
                        <Link href="/privacy" className="rounded-full border border-border/50 px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-muted/60 transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="rounded-full border border-border/50 px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-muted/60 transition-colors">Terms of Service</Link>
                    </div>
                </section>
            </div>
        </main>
    )
}
