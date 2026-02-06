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
        .select('username, chat_mode, theme, chat_wallpaper, subscription_tier, daily_msg_count, last_msg_reset')
        .eq('id', user.id)
        .single()

    const dailyLimit = profile?.subscription_tier === 'pro' ? 300 : 80

    return (
        <main className="min-h-dvh bg-background text-foreground px-6 py-10">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Settings</div>
                        <h1 className="text-4xl font-black">Your Control Center</h1>
                    </div>
                    <Link
                        href="/chat"
                        className="text-[10px] uppercase tracking-widest border border-white/10 rounded-full px-4 py-2 hover:bg-white/10"
                    >
                        Back to Chat
                    </Link>
                </div>

                <SettingsPanel
                    username={profile?.username ?? null}
                    initialSettings={{
                        chat_mode: (profile?.chat_mode as 'entourage' | 'ecosystem') || 'ecosystem',
                        theme: (profile?.theme as 'light' | 'dark') || 'dark',
                        chat_wallpaper: (profile?.chat_wallpaper as 'default' | 'neon' | 'soft') || 'default'
                    }}
                    usage={{
                        dailyCount: profile?.daily_msg_count ?? 0,
                        dailyLimit,
                        lastReset: profile?.last_msg_reset ?? null,
                        subscriptionTier: profile?.subscription_tier ?? 'free'
                    }}
                />
            </div>
        </main>
    )
}
