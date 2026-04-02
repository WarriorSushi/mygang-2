'use client'

import Image from 'next/image'
import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { LottieLoader } from '@/components/ui/lottie-loader'
import { buildArrivalLoaderSteps, type PendingArrivalContext } from '@/lib/chat-arrival'
import { cn } from '@/lib/utils'

const STEP_DURATION_MS = 1500

interface LoadingStepProps {
    arrivalContext: PendingArrivalContext
}

export function LoadingStep({ arrivalContext }: LoadingStepProps) {
    const prefersReducedMotion = useReducedMotion()
    const steps = useMemo(() => buildArrivalLoaderSteps(arrivalContext), [arrivalContext])
    const [currentStepIndex, setCurrentStepIndex] = useState(0)

    useEffect(() => {
        if (prefersReducedMotion) return
        if (steps.length <= 1) return

        const interval = window.setInterval(() => {
            setCurrentStepIndex((current) => (
                current >= steps.length - 1 ? current : current + 1
            ))
        }, STEP_DURATION_MS)

        return () => window.clearInterval(interval)
    }, [prefersReducedMotion, steps.length])

    const displayedStepIndex = prefersReducedMotion
        ? Math.max(steps.length - 1, 0)
        : currentStepIndex
    const currentStep = steps[displayedStepIndex] ?? steps[0]
    const progress = `${((displayedStepIndex + 1) / Math.max(steps.length, 1)) * 100}%`

    return (
        <m.section
            key="loading"
            data-testid="onboarding-arrival-screen"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative my-auto w-full max-w-5xl px-1 sm:px-3"
        >
            <div className="pointer-events-none absolute inset-x-0 top-[-14%] mx-auto h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.28),rgba(52,211,153,0)_72%)] blur-3xl" />
            <div className="pointer-events-none absolute right-[8%] top-[14%] h-44 w-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.2),rgba(96,165,250,0)_74%)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-10%] left-[4%] h-52 w-52 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.18),rgba(244,114,182,0)_76%)] blur-3xl" />

            <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(10,14,24,0.88),rgba(10,14,24,0.56))] p-6 shadow-[0_30px_90px_-48px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-8">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1">
                            Joining your crew
                        </span>
                        <span className="text-white/45">
                            Step {displayedStepIndex + 1} of {steps.length}
                        </span>
                    </div>

                    <div className="mt-6 flex items-start gap-4 sm:gap-5">
                        <div className="relative shrink-0 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(16,185,129,0)_70%)]" />
                            <LottieLoader size={52} loop className="opacity-95" />
                        </div>

                        <div className="min-w-0">
                            <h2 className="text-[clamp(2rem,4vw,3.6rem)] font-black leading-[0.95] tracking-[-0.05em] text-white">
                                {currentStep.title}
                            </h2>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-white/74 sm:text-[15px]">
                                {currentStep.detail}
                            </p>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-100/66">
                                {currentStep.caption}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(45,212,191,0.95),rgba(59,130,246,0.86),rgba(244,114,182,0.82))] transition-[width] duration-700 ease-out"
                                style={{ width: progress }}
                            />
                        </div>
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                        {arrivalContext.squad.map((character, index) => (
                            <div
                                key={character.id}
                                className={cn(
                                    'relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl transition-all duration-500',
                                    index <= displayedStepIndex ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-75'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[1rem] border border-white/12 bg-white/5">
                                        {character.avatar ? (
                                            <Image
                                                src={character.avatar}
                                                alt={character.displayName}
                                                fill
                                                className="object-cover"
                                                sizes="48px"
                                                priority={index < 2}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/72">
                                                {character.displayName.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-white">
                                            {character.displayName}
                                        </div>
                                        <div className="truncate text-[11px] uppercase tracking-[0.2em] text-white/44">
                                            {character.roleLabel || character.archetype || 'friend'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.9)] backdrop-blur-2xl sm:p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/52">
                        What happens next
                    </div>
                    <div className="mt-5 space-y-3">
                        {steps.map((step, index) => {
                            const isCurrent = index === displayedStepIndex
                            const isComplete = index < displayedStepIndex

                            return (
                                <div
                                    key={step.title}
                                    data-testid={isCurrent ? 'onboarding-arrival-step-current' : undefined}
                                    className={cn(
                                        'rounded-[1.4rem] border p-4 transition-all duration-400',
                                        isCurrent
                                            ? 'border-emerald-300/30 bg-emerald-400/10 shadow-[0_18px_42px_-30px_rgba(16,185,129,0.75)]'
                                            : isComplete
                                                ? 'border-white/10 bg-white/[0.045]'
                                                : 'border-white/8 bg-white/[0.02]'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={cn(
                                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                                isCurrent
                                                    ? 'bg-emerald-300/20 text-emerald-100'
                                                    : isComplete
                                                        ? 'bg-white/10 text-white/80'
                                                        : 'bg-white/6 text-white/45'
                                            )}
                                        >
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-white">
                                                {step.title}
                                            </div>
                                            <p className="mt-1 text-sm leading-6 text-white/60">
                                                {step.detail}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/48">
                            First session perk
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/74">
                            Memory Vault starts open with your first {arrivalContext.memoryPreviewLimit} memories visible, so the app feels like it is learning you from day one.
                        </p>
                    </div>
                </aside>
            </div>
        </m.section>
    )
}
