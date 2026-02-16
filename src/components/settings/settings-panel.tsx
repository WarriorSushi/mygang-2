'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { deleteAccount, signOut, updateUserSettings } from '@/app/auth/actions'
import { Switch } from '@/components/ui/switch'
import { trackEvent } from '@/lib/analytics'
import { useChatStore } from '@/stores/chat-store'

interface SettingsPanelProps {
    username: string | null
    email: string | null
    initialSettings: {
        theme: 'light' | 'dark'
        lowCostMode: boolean
    }
    usage: {
        dailyCount: number
        dailyLimit: number
        lastReset: string | null
        subscriptionTier: string | null
    }
}

const PERF_KEY = 'perf_monitoring'

export function SettingsPanel({ username, email, initialSettings, usage }: SettingsPanelProps) {
    const { setTheme } = useTheme()
    const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>(initialSettings.theme)
    const [lowCostMode, setLowCostMode] = useState<boolean>(initialSettings.lowCostMode)
    const [perfEnabled, setPerfEnabled] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(PERF_KEY) === 'true'
    })
    const isProd = process.env.NODE_ENV === 'production'

    const handleTheme = (nextTheme: 'light' | 'dark') => {
        setThemeChoice(nextTheme)
        setTheme(nextTheme)
        updateUserSettings({ theme: nextTheme })
    }

    const handlePerfToggle = (next: boolean) => {
        setPerfEnabled(next)
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PERF_KEY, next ? 'true' : 'false')
        }
        trackEvent(next ? 'perf_monitoring_enabled' : 'perf_monitoring_disabled')
    }

    const handleLowCostModeToggle = (next: boolean) => {
        setLowCostMode(next)
        useChatStore.getState().setLowCostMode(next)
        updateUserSettings({ low_cost_mode: next })
        trackEvent(next ? 'low_cost_mode_enabled' : 'low_cost_mode_disabled', {
            metadata: { source: 'settings_page' }
        })
    }

    const resetText = usage.lastReset ? new Date(usage.lastReset).toLocaleString() : 'Unknown'

    return (
        <div className="space-y-8">
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</div>
                <div className="mt-2 text-2xl font-black">{username || 'Member'}</div>
                <div className="mt-1 text-xs text-muted-foreground break-all">{email || 'Email unavailable'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        variant={themeChoice === 'dark' ? 'default' : 'outline'}
                        onClick={() => handleTheme('dark')}
                        aria-pressed={themeChoice === 'dark'}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Dark
                    </Button>
                    <Button
                        variant={themeChoice === 'light' ? 'default' : 'outline'}
                        onClick={() => handleTheme('light')}
                        aria-pressed={themeChoice === 'light'}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Light
                    </Button>
                </div>
            </section>

            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Usage</div>
                <div className="mt-2 text-lg font-semibold">
                    {usage.dailyCount} / {usage.dailyLimit} messages today
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Resets: {resetText}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Tier: {usage.subscriptionTier || 'free'}</div>
            </section>

            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Performance</div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="text-sm font-semibold">Production monitoring</div>
                        <div className="text-[11px] text-muted-foreground">
                            Captures LCP, CLS, and long tasks in production.
                        </div>
                    </div>
                    <Switch
                        checked={perfEnabled}
                        onCheckedChange={handlePerfToggle}
                        disabled={!isProd}
                        aria-label="Toggle production monitoring"
                    />
                </div>
                {!isProd && (
                    <div className="mt-2 text-[11px] text-muted-foreground">Enable this in production builds.</div>
                )}
            </section>

            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost Control</div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="text-sm font-semibold">Low-Cost Mode</div>
                        <div className="text-[11px] text-muted-foreground">
                            Limits autonomous turns and shrinks AI context to reduce quota usage.
                        </div>
                    </div>
                    <Switch
                        checked={lowCostMode}
                        onCheckedChange={handleLowCostModeToggle}
                        aria-label="Toggle low-cost mode"
                    />
                </div>
            </section>

            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account Actions</div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <form action={signOut}>
                        <Button variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            Sign Out
                        </Button>
                    </form>
                    <Button
                        variant="destructive"
                        className="rounded-full text-[10px] uppercase tracking-widest"
                        onClick={async () => {
                            const confirmed = confirm('Delete your account and all data? This cannot be undone.')
                            if (!confirmed) return
                            await deleteAccount()
                        }}
                    >
                        Delete Account
                    </Button>
                </div>
            </section>
        </div>
    )
}
