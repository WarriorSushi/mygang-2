'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { updateUserSettings } from '@/app/auth/actions'
import { useChatStore } from '@/stores/chat-store'

interface SettingsPanelProps {
    username: string | null
    initialSettings: {
        chat_mode: 'entourage' | 'ecosystem'
        theme: 'light' | 'dark'
        chat_wallpaper: 'default' | 'neon' | 'soft'
    }
    usage: {
        dailyCount: number
        dailyLimit: number
        lastReset: string | null
        subscriptionTier: string | null
    }
}

export function SettingsPanel({ username, initialSettings, usage }: SettingsPanelProps) {
    const { setTheme } = useTheme()
    const { setChatMode, setChatWallpaper } = useChatStore()
    const [chatMode, setChatModeLocal] = useState(initialSettings.chat_mode)
    const [wallpaper, setWallpaper] = useState(initialSettings.chat_wallpaper)

    const handleTheme = (nextTheme: 'light' | 'dark') => {
        setTheme(nextTheme)
        updateUserSettings({ theme: nextTheme })
    }

    const handleChatMode = (mode: 'entourage' | 'ecosystem') => {
        setChatModeLocal(mode)
        setChatMode(mode)
        updateUserSettings({ chat_mode: mode })
    }

    const handleWallpaper = (next: 'default' | 'neon' | 'soft') => {
        setWallpaper(next)
        setChatWallpaper(next)
        updateUserSettings({ chat_wallpaper: next })
    }

    const resetText = usage.lastReset ? new Date(usage.lastReset).toLocaleString() : 'Unknown'

    return (
        <div className="space-y-8">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</div>
                <div className="mt-2 text-2xl font-black">{username || 'Member'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => handleTheme('dark')} className="rounded-full text-[10px] uppercase tracking-widest">
                        Dark
                    </Button>
                    <Button variant="outline" onClick={() => handleTheme('light')} className="rounded-full text-[10px] uppercase tracking-widest">
                        Light
                    </Button>
                </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Chat Mode</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        variant={chatMode === 'entourage' ? 'default' : 'outline'}
                        onClick={() => handleChatMode('entourage')}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Entourage
                    </Button>
                    <Button
                        variant={chatMode === 'ecosystem' ? 'default' : 'outline'}
                        onClick={() => handleChatMode('ecosystem')}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Ecosystem
                    </Button>
                </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Wallpaper</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {(['default', 'neon', 'soft'] as const).map((option) => (
                        <Button
                            key={option}
                            variant={wallpaper === option ? 'default' : 'outline'}
                            onClick={() => handleWallpaper(option)}
                            className="rounded-full text-[10px] uppercase tracking-widest"
                        >
                            {option}
                        </Button>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Usage</div>
                <div className="mt-2 text-lg font-semibold">
                    {usage.dailyCount} / {usage.dailyLimit} messages today
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Resets: {resetText}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Tier: {usage.subscriptionTier || 'free'}</div>
            </section>
        </div>
    )
}
