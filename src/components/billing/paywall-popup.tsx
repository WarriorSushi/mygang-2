'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from 'next/link'

interface PaywallPopupProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cooldownSeconds: number
    tier: string
}

function formatTimeLeft(totalSeconds: number): string {
    if (totalSeconds <= 0) return '0:00'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PaywallPopup({ open, onOpenChange, cooldownSeconds, tier }: PaywallPopupProps) {
    const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)

    // Reset countdown when cooldownSeconds changes or dialog opens
    useEffect(() => {
        if (open) {
            setSecondsLeft(cooldownSeconds)
        }
    }, [cooldownSeconds, open])

    // Countdown timer
    useEffect(() => {
        if (!open || secondsLeft <= 0) return
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
    }, [open, secondsLeft])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-background/60 backdrop-blur-3xl border-border/50 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

                <div className="p-8">
                    <DialogHeader className="flex flex-col items-center gap-4 pb-4">
                        <DialogTitle className="text-xl sm:text-2xl font-black text-center tracking-tight leading-tight">
                            <span className="text-3xl">😅</span> ok so... we kinda blew up
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm sm:text-base text-muted-foreground/80 leading-relaxed max-w-[360px]">
                            due to unexpected (but very welcome) adoption, we had to cap the {tier} tier
                            before our servers start crying. your gang still loves you — they just need
                            a coffee break.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-5 py-4">
                        {/* Countdown */}
                        <div className="text-center">
                            <p className="text-lg sm:text-xl text-muted-foreground/90">
                                <span className="text-xl">☕</span> come back in{' '}
                                <span className="font-mono font-bold text-foreground text-2xl tabular-nums">
                                    {formatTimeLeft(secondsLeft)}
                                </span>
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 w-full">
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-xs text-muted-foreground/50 uppercase tracking-widest font-medium">or skip the wait forever</span>
                            <div className="flex-1 h-px bg-border/50" />
                        </div>

                        {/* CTA */}
                        <Button
                            asChild
                            className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                        >
                            <Link href="/pricing?upgrade=pro">
                                🚀 Upgrade to Pro — $19.99/mo
                            </Link>
                        </Button>

                        <p className="text-sm text-muted-foreground/70 text-center">
                            <span className="line-through text-muted-foreground/40">$99/mo</span>{' '}
                            <span className="text-primary font-semibold">80% off launch week</span>
                        </p>

                        {/* Feature list */}
                        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground/80 w-full">
                            <p>✓ unlimited messages</p>
                            <p>✓ your gang remembers everything</p>
                            <p>✓ no cooldowns, ever</p>
                        </div>

                        {/* View All Plans link */}
                        <Link
                            href="/pricing"
                            className="text-sm text-muted-foreground/60 hover:text-foreground underline underline-offset-4 transition-colors"
                        >
                            View All Plans
                        </Link>

                        {/* Footer */}
                        <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
                            (your besties aren&apos;t going anywhere — they&apos;re just napping 💤)
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
