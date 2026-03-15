'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { Gift, Sparkles, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Lottie = lazy(() => import('lottie-react'))

export function AvatarGiftStep({ onNext }: { onNext: () => void }) {
    const [animationData, setAnimationData] = useState<object | null>(null)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
        updatePreference()

        mediaQuery.addEventListener('change', updatePreference)
        return () => mediaQuery.removeEventListener('change', updatePreference)
    }, [])

    useEffect(() => {
        if (prefersReducedMotion) return

        let cancelled = false

        fetch('/lottie/confetti.json')
            .then((response) => response.json())
            .then((data) => {
                if (!cancelled) setAnimationData(data)
            })
            .catch(() => {})

        return () => {
            cancelled = true
        }
    }, [prefersReducedMotion])

    return (
        <m.section
            key="avatar-gift"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            data-testid="onboarding-avatar-gift-step"
            className="relative mx-auto flex min-h-full w-full max-w-3xl items-center justify-center px-1 py-8 sm:py-12"
        >
            <div className="absolute inset-0 -z-10 overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.16),_transparent_44%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.08),_transparent_48%)]" />
            {!prefersReducedMotion && animationData && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
                    <Suspense fallback={null}>
                        <Lottie
                            animationData={animationData}
                            autoplay
                            loop={false}
                            style={{
                                position: 'absolute',
                                inset: '-8%',
                                opacity: 0.9,
                            }}
                        />
                    </Suspense>
                </div>
            )}

            <div className="relative w-full overflow-hidden rounded-[2rem] border border-amber-300/28 bg-card/90 p-6 shadow-[0_24px_90px_-46px_rgba(245,158,11,0.55)] backdrop-blur-2xl sm:p-10">
                <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />
                <div className="flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-700 dark:text-amber-200">
                        <Gift className="h-3.5 w-3.5" />
                        Early user gift
                    </div>

                    <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-amber-300/22 via-rose-300/14 to-emerald-300/16 shadow-inner shadow-white/15">
                        <Sparkles className="h-8 w-8 text-amber-400" />
                    </div>

                    <h2 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">
                        Free for Life
                    </h2>
                    <p className="mt-3 text-lg font-semibold text-foreground/88 sm:text-2xl">
                        Gift from us to you.
                    </p>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                        We unlocked the Human and Retro avatar packs forever for early users, so your gang starts with more ways to look and feel right.
                    </p>

                    <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-border/45 bg-background/70 px-5 py-4 text-left">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-200">
                                <Gift className="h-3.5 w-3.5" />
                                Human pack
                            </div>
                            <p className="mt-2 text-sm text-foreground/82">
                                Softer, more cinematic portraits.
                            </p>
                        </div>
                        <div className="rounded-[1.4rem] border border-border/45 bg-background/70 px-5 py-4 text-left">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-200">
                                <Unlock className="h-3.5 w-3.5" />
                                Retro pack
                            </div>
                            <p className="mt-2 text-sm text-foreground/82">
                                Playful arcade energy with nostalgic charm.
                            </p>
                        </div>
                    </div>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                        Pick your look on the next screen
                    </p>

                    <Button
                        size="lg"
                        onClick={onNext}
                        data-testid="onboarding-avatar-gift-next"
                        className="mt-7 rounded-full px-8 py-6 text-base font-bold shadow-[0_18px_50px_-28px_rgba(217,119,6,0.75)]"
                    >
                        Choose my style
                    </Button>
                </div>
            </div>
        </m.section>
    )
}
