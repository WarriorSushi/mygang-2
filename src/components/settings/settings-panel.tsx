'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteAccount, signOut, updateUserSettings } from '@/app/auth/actions'
import { Switch } from '@/components/ui/switch'
import { trackEvent } from '@/lib/analytics'
import { useChatStore } from '@/stores/chat-store'
import { Crown, Zap, Brain, Infinity, ArrowRight, Check } from 'lucide-react'

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

function UpgradeCard({ tier }: { tier: string | null }) {
    const isPro = tier === 'pro'
    const isBasic = tier === 'basic'
    const isFree = !tier || tier === 'free'

    if (isPro) {
        return (
            <section className="relative rounded-3xl border border-primary/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
                <div className="relative p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-primary/15">
                            <Crown className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Pro Plan</div>
                    </div>
                    <p className="text-sm font-semibold mt-1">You&apos;re on the best plan.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Unlimited messages, full memory, zero cooldowns.
                    </p>
                    <div className="mt-4 flex gap-2">
                        <Button asChild variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            <Link href="/api/customer-portal">Manage Subscription</Link>
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    if (isBasic) {
        return (
            <section className="relative rounded-3xl border border-border/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/3" />
                <div className="relative p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/15">
                            <Zap className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-blue-500 dark:text-blue-400 font-bold">Basic Plan</div>
                    </div>
                    <p className="text-sm font-semibold mt-1">1,000 messages/month + memory</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Want unlimited? Upgrade to Pro.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild className="rounded-full text-[10px] uppercase tracking-widest">
                            <Link href="/pricing">
                                Upgrade to Pro
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            <Link href="/api/customer-portal">Manage</Link>
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    // Free tier — this is the enticing upgrade card
    return (
        <section className="relative rounded-3xl border border-primary/20 overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
            {/* Subtle animated gradient bar at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient" />

            <div className="relative p-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/20 text-[10px] font-bold uppercase tracking-widest text-accent mb-4">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                    </span>
                    80% off — launch week
                </div>

                <h3 className="text-xl font-black tracking-tight">
                    Unlock the full gang experience
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed max-w-sm">
                    You&apos;re on the free tier (20 msgs/hr, no memory). Your gang wants to remember you.
                </p>

                {/* Feature pills */}
                <div className="mt-4 flex flex-col gap-2">
                    {[
                        { icon: <Infinity className="w-3 h-3" />, text: 'Unlimited messages' },
                        { icon: <Brain className="w-3 h-3" />, text: 'Your gang remembers everything' },
                        { icon: <Zap className="w-3 h-3" />, text: 'Zero cooldowns, ever' },
                    ].map((f) => (
                        <div key={f.text} className="flex items-center gap-2">
                            <div className="shrink-0 text-primary">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[12px] text-foreground/80">{f.text}</span>
                        </div>
                    ))}
                </div>

                {/* Price + CTA */}
                <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-4">
                    <div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black tracking-tight">$19.99</span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            <span className="line-through opacity-50">$99/mo</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild className="rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
                            <Link href="/pricing">
                                <Crown className="w-3 h-3 mr-1" />
                                View Plans
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}

export function SettingsPanel({ username, email, initialSettings, usage }: SettingsPanelProps) {
    const { setTheme } = useTheme()
    const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>(initialSettings.theme)
    const [lowCostMode, setLowCostMode] = useState<boolean>(initialSettings.lowCostMode)
    const [deleteEmail, setDeleteEmail] = useState('')
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
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

    return (
        <div className="space-y-6">
            {/* Account */}
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

            {/* Plan & Upgrade — placed high for visibility */}
            <UpgradeCard tier={usage.subscriptionTier} />

            {/* Usage */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Usage</div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black tabular-nums">{usage.dailyCount}</span>
                    <span className="text-sm text-muted-foreground">/ {usage.dailyLimit} messages today</span>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${Math.min(100, (usage.dailyCount / usage.dailyLimit) * 100)}%` }}
                    />
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground capitalize">
                        {usage.subscriptionTier || 'free'} tier
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {usage.lastReset ? `Resets: ${new Date(usage.lastReset).toLocaleString()}` : ''}
                    </span>
                </div>
            </section>

            {/* Performance */}
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

            {/* Cost Control */}
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

            {/* Account Actions */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account Actions</div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        className="rounded-full text-[10px] uppercase tracking-widest"
                        onClick={async () => {
                            const store = useChatStore.getState()
                            store.setUserId(null)
                            store.setActiveGang([])
                            store.clearChat()
                            store.setUserName(null)
                            store.setUserNickname(null)
                            store.setCustomCharacterNames({})
                            await signOut()
                        }}
                    >
                        Sign Out
                    </Button>
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-destructive">Danger Zone</div>
                    <p className="text-[11px] text-destructive/80">Type your email to confirm account deletion. This cannot be undone.</p>
                    <input
                        type="email"
                        value={deleteEmail}
                        onChange={(e) => {
                            setDeleteEmail(e.target.value)
                            if (deleteError) setDeleteError(null)
                        }}
                        placeholder={email || 'your@email.com'}
                        className="h-10 w-full rounded-lg border border-destructive/40 bg-background/70 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-destructive"
                        autoComplete="email"
                    />
                    {deleteError && (
                        <p className="text-[10px] text-destructive">{deleteError}</p>
                    )}
                    <Button
                        variant="destructive"
                        className="rounded-full text-[10px] uppercase tracking-widest w-full"
                        disabled={isDeleting || !email || deleteEmail.trim().toLowerCase() !== (email || '').trim().toLowerCase()}
                        onClick={async () => {
                            if (!email || deleteEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
                                setDeleteError('Type your exact email to confirm.')
                                return
                            }
                            const confirmed = confirm('Delete your account and all data? This cannot be undone.')
                            if (!confirmed) return
                            setIsDeleting(true)
                            try {
                                await deleteAccount()
                            } catch (err) {
                                const message = err instanceof Error ? err.message : ''
                                if (!message.includes('NEXT_REDIRECT')) {
                                    setDeleteError('Could not delete account. Please try again.')
                                }
                            } finally {
                                setIsDeleting(false)
                            }
                        }}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </Button>
                </div>
            </section>
        </div>
    )
}
