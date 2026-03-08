'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { Clock, Infinity, Brain, Zap, ArrowRight, Check, Users, Sparkles, Palette, MessageCircle } from 'lucide-react'
import { getTierCopy } from '@/lib/billing'

interface PaywallPopupProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cooldownSeconds: number
    tier: string
    onOpenSettings?: () => void
    onOpenMemoryVault?: () => void
    onOpenWallpaper?: () => void
}

function formatTimeLeft(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0:00'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const FREE_TIER_FEATURES = {
    basic: [
        { icon: Zap, text: getTierCopy('basic').messagesLabel },
        { icon: Brain, text: getTierCopy('basic').memoryLabel },
        { icon: Sparkles, text: 'Ecosystem mode' },
    ],
    pro: [
        { icon: Infinity, text: getTierCopy('pro').messagesLabel },
        { icon: Brain, text: getTierCopy('pro').memoryLabel },
        { icon: Users, text: '6 squad members' },
    ],
}

const BASIC_TIER_FEATURES = [
    { icon: Infinity, text: getTierCopy('pro').messagesLabel },
    { icon: Brain, text: 'Inside jokes & mood tracking' },
    { icon: Users, text: '6 squad members' },
    { icon: Sparkles, text: 'Character-specific memories' },
]

export function PaywallPopup({ open, onOpenChange, cooldownSeconds, tier, onOpenSettings, onOpenMemoryVault, onOpenWallpaper }: PaywallPopupProps) {
    const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
    const isFree = tier === 'free'
    const isBasic = tier === 'basic'
    const tierCopy = getTierCopy(tier === 'basic' ? 'basic' : tier === 'pro' ? 'pro' : 'free')

    // Reset countdown when cooldownSeconds changes or dialog opens
    useEffect(() => {
        if (open) {
            setSecondsLeft(cooldownSeconds)
        }
    }, [cooldownSeconds, open])

    // Track initial cooldown for "try now" threshold
    const [initialCooldown, setInitialCooldown] = useState(cooldownSeconds)
    useEffect(() => {
        if (open && cooldownSeconds > 0) setInitialCooldown(cooldownSeconds)
    }, [cooldownSeconds, open])

    // Countdown timer -- M17: removed secondsLeft from deps to prevent interval restart loop
    useEffect(() => {
        if (!open) return
        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [open])

    // Auto-dismiss when countdown reaches 0
    useEffect(() => {
        if (open && secondsLeft === 0) {
            const timer = setTimeout(() => onOpenChange(false), 1500)
            return () => clearTimeout(timer)
        }
    }, [open, secondsLeft, onOpenChange])

    // Show "try now" after 30% of cooldown elapsed (sliding window frees slots gradually)
    const elapsed = initialCooldown - secondsLeft
    const showTryNow = secondsLeft > 0 && elapsed >= Math.max(60, initialCooldown * 0.3)

    const handleClose = () => onOpenChange(false)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-background/60 backdrop-blur-3xl border-border/50 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

                <div className="p-8">
                    <DialogHeader className="flex flex-col items-center gap-4 pb-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl sm:text-2xl font-black text-center tracking-tight leading-tight">
                            Cooldown active
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground/80 leading-relaxed max-w-[340px]">
                            You&apos;ve hit the {tierCopy.label.toLowerCase()} tier limit. Your gang will be back soon.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-5 py-4">
                        {/* Countdown */}
                        <div className="text-center flex flex-col items-center gap-1" aria-live="polite" aria-atomic="true">
                            <div className="flex items-center gap-2.5">
                                <span className="text-sm text-muted-foreground/70">{secondsLeft === 0 ? 'Ready!' : 'Fully resets in'}</span>
                                {secondsLeft > 0 && (
                                    <span className="font-mono font-bold text-foreground text-3xl tabular-nums tracking-tight">
                                        {formatTimeLeft(secondsLeft)}
                                    </span>
                                )}
                            </div>
                            {secondsLeft > 0 && (
                                <p className="text-[11px] text-muted-foreground/60">Messages come back gradually — some may be available sooner</p>
                            )}
                        </div>

                        {/* Try now button — appears after some time has passed */}
                        {showTryNow && (
                            <Button
                                variant="outline"
                                className="rounded-full text-[11px] font-semibold border-primary/30 text-primary hover:bg-primary/10"
                                onClick={handleClose}
                            >
                                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                                Try sending a message
                            </Button>
                        )}

                        {/* Divider */}
                        <div className="flex items-center gap-3 w-full">
                            <div className="flex-1 h-px bg-border/40" />
                            <span className="text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50 uppercase tracking-widest font-medium">or skip the wait</span>
                            <div className="flex-1 h-px bg-border/40" />
                        </div>

                        {/* Tier-specific feature lists */}
                        {isFree && (
                            <>
                                {/* Pro features for free users */}
                                <div className="flex flex-col gap-2.5 w-full">
                                    {FREE_TIER_FEATURES.pro.map((f) => (
                                        <div key={f.text} className="flex items-center gap-2.5">
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                            <span className="text-sm text-foreground/80">{f.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA -- Pro */}
                                <Button
                                    asChild
                                    className="w-full h-12 rounded-xl text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                                >
                                    <Link href="/pricing?upgrade=pro" className="flex items-center justify-center gap-2">
                                        Get Pro — {getTierCopy('pro').priceLabel}
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </Button>

                                <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground/60 text-center">
                                    <span className="text-primary font-medium">Launch price</span>
                                </p>

                                {/* Basic option for free users */}
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full h-10 rounded-xl text-[13px] font-semibold border-blue-600/35 dark:border-blue-500/25 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 transition-all"
                                >
                                    <Link href="/pricing?upgrade=basic" className="flex items-center justify-center gap-2">
                                        Or get Basic — {getTierCopy('basic').priceLabel}
                                    </Link>
                                </Button>
                            </>
                        )}

                        {isBasic && (
                            <>
                                {/* Pro features for basic users */}
                                <div className="flex flex-col gap-2.5 w-full">
                                    {BASIC_TIER_FEATURES.map((f) => (
                                        <div key={f.text} className="flex items-center gap-2.5">
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                            <span className="text-sm text-foreground/80">{f.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Single CTA -- Pro */}
                                <Button
                                    asChild
                                    className="w-full h-12 rounded-xl text-[15px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                                >
                                    <Link href="/pricing?upgrade=pro" className="flex items-center justify-center gap-2">
                                        Upgrade to Pro — {getTierCopy('pro').priceLabel}
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </Button>

                                <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground/60 text-center">
                                    <span className="text-primary font-medium">Launch price</span>
                                </p>
                            </>
                        )}

                        {/* Cooldown engagement suggestions */}
                        {secondsLeft > 0 && (
                            <>
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex-1 h-px bg-border/40" />
                                    <span className="text-[10px] text-muted-foreground/70 dark:text-muted-foreground/50 uppercase tracking-widest font-medium">while you wait</span>
                                    <div className="flex-1 h-px bg-border/40" />
                                </div>
                                <div className="flex flex-wrap gap-2 w-full justify-center">
                                    {onOpenSettings && !isFree && (
                                        <button
                                            type="button"
                                            onClick={() => { handleClose(); onOpenSettings() }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/40 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                                        >
                                            <Users className="w-3 h-3" />
                                            Customize your squad
                                        </button>
                                    )}
                                    {onOpenMemoryVault && !isFree && (
                                        <button
                                            type="button"
                                            onClick={() => { handleClose(); onOpenMemoryVault() }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/40 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                                        >
                                            <Brain className="w-3 h-3" />
                                            Review your memories
                                        </button>
                                    )}
                                    {onOpenWallpaper && !isFree && (
                                        <button
                                            type="button"
                                            onClick={() => { handleClose(); onOpenWallpaper() }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/40 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                                        >
                                            <Palette className="w-3 h-3" />
                                            Change your wallpaper
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
