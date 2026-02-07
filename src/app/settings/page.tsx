import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsPanel } from '@/components/settings/settings-panel'
import type { ChatWallpaper } from '@/constants/wallpapers'

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
        <main className="min-h-dvh bg-background text-foreground px-4 sm:px-6 lg:px-10 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Settings</div>
                        <h1 className="text-3xl sm:text-4xl font-black">Your Control Center</h1>
                    </div>
                    <Link
                        href="/chat"
                        className="text-[10px] uppercase tracking-widest border border-white/10 rounded-full px-4 py-2 hover:bg-white/10 w-fit"
                    >
                        Back to Chat
                    </Link>
                </div>

                <SettingsPanel
                    username={profile?.username ?? null}
                    initialSettings={{
                        chat_mode: (profile?.chat_mode as 'entourage' | 'ecosystem') || 'ecosystem',
                        theme: (profile?.theme as 'light' | 'dark') || 'dark',
                        chat_wallpaper: (profile?.chat_wallpaper as ChatWallpaper) || 'default'
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
