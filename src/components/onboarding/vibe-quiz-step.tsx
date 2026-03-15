'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VibeProfile } from '@/lib/ai/character-recommendation'

interface VibeQuizStepProps {
    onNext: (vibe: VibeProfile) => void
}

type QuestionKey = 'primary_intent' | 'warmth_style' | 'chaos_level'

type QuestionDefinition = {
    key: QuestionKey
    reviewLabel: string
    title: string
    options: { value: string; label: string; emoji: string }[]
}

const QUESTIONS: QuestionDefinition[] = [
    {
        key: 'primary_intent',
        reviewLabel: 'Crew mission',
        title: 'What do you want most from your gang?',
        options: [
            { value: 'hype', label: 'Hype me up', emoji: '\u{1F525}' },
            { value: 'honest', label: 'Real talk', emoji: '\u{1F4AF}' },
            { value: 'humor', label: 'Make me laugh', emoji: '\u{1F602}' },
            { value: 'chill', label: 'Chill vibes', emoji: '\u{1F30A}' },
        ],
    },
    {
        key: 'warmth_style',
        reviewLabel: 'Tone',
        title: 'How should they talk to you?',
        options: [
            { value: 'warm', label: 'Warm and supportive', emoji: '\u{1F49B}' },
            { value: 'balanced', label: 'Balanced mix', emoji: '\u{2696}\u{FE0F}' },
            { value: 'edgy', label: 'Unfiltered and sarcastic', emoji: '\u{1F525}' },
        ],
    },
    {
        key: 'chaos_level',
        reviewLabel: 'Energy',
        title: "What's the energy?",
        options: [
            { value: 'calm', label: 'Keep it chill', emoji: '\u{2615}' },
            { value: 'lively', label: 'Lively and fun', emoji: '\u{26A1}' },
            { value: 'chaotic', label: 'Pure chaos', emoji: '\u{1F4A5}' },
        ],
    },
]

const ADVANCE_DELAY_MS = 120

export function VibeQuizStep({ onNext }: VibeQuizStepProps) {
    const prefersReducedMotion = useReducedMotion()
    const [answers, setAnswers] = useState<Partial<Record<QuestionKey, string>>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [direction, setDirection] = useState(1)
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const isReviewStep = currentIndex >= QUESTIONS.length
    const currentQuestion = QUESTIONS[Math.min(currentIndex, QUESTIONS.length - 1)]
    const allAnswered = QUESTIONS.every((question) => answers[question.key])

    useEffect(() => {
        return () => {
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
        }
    }, [])

    const jumpToStep = (index: number) => {
        if (advanceTimerRef.current) {
            clearTimeout(advanceTimerRef.current)
            advanceTimerRef.current = null
        }
        setDirection(index > currentIndex ? 1 : -1)
        setCurrentIndex(index)
    }

    const handleSelect = (key: QuestionKey, value: string) => {
        setAnswers((previous) => ({ ...previous, [key]: value }))

        const questionIndex = QUESTIONS.findIndex((question) => question.key === key)
        const nextIndex = questionIndex === QUESTIONS.length - 1 ? QUESTIONS.length : questionIndex + 1
        setDirection(1)

        if (prefersReducedMotion) {
            setCurrentIndex(nextIndex)
            return
        }

        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = setTimeout(() => {
            setCurrentIndex(nextIndex)
            advanceTimerRef.current = null
        }, ADVANCE_DELAY_MS)
    }

    const handleSubmit = () => {
        if (!allAnswered) return
        onNext(answers as VibeProfile)
    }

    return (
        <m.section
            key="vibe-quiz"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -16 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto flex w-full max-w-2xl flex-col px-1 pb-6 pt-1 sm:pt-2 my-auto"
            data-testid="onboarding-vibe-quiz-step"
        >
            <div className="mx-auto w-full max-w-md text-center">
                <h2 className="text-[1.5rem] font-black tracking-tight sm:text-[1.85rem] sm:leading-[0.96]">
                    Set the vibe
                </h2>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Three quick picks.</p>
            </div>

            <div className="mx-auto mt-3 w-full max-w-xl">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                    {!isReviewStep ? (
                        <m.div
                            key={currentQuestion.key}
                            custom={direction}
                            initial={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? 18 : -18 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                            exit={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? -18 : 18 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="rounded-[1.75rem] border border-border/50 bg-card/88 p-4 shadow-[0_24px_72px_-56px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:p-5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                                        Question {currentIndex + 1} of {QUESTIONS.length}
                                    </div>
                                    <h3 className="mt-1.5 max-w-md text-[1.35rem] font-black tracking-tight text-foreground sm:text-[1.6rem] sm:leading-[1.05]">
                                        {currentQuestion.title}
                                    </h3>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground/60 text-center">Select one</p>
                                </div>
                                {currentIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => jumpToStep(currentIndex - 1)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/72 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                        Back
                                    </button>
                                )}
                            </div>

                            <div className="mt-3.5 space-y-2">
                                {currentQuestion.options.map((option) => {
                                    const isSelected = answers[currentQuestion.key] === option.value

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(currentQuestion.key, option.value)}
                                            data-testid={`vibe-${currentQuestion.key}-${option.value}`}
                                            className={cn(
                                                'flex w-full items-center gap-3 rounded-[1.15rem] border px-3.5 py-2.5 text-left transition-all duration-150 shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] sm:px-4 sm:py-3',
                                                isSelected
                                                    ? 'border-primary/40 bg-primary/8 shadow-[0_2px_12px_-2px_rgba(var(--primary-rgb,99,102,241),0.3)]'
                                                    : 'border-border/45 bg-background/72 hover:border-primary/20 hover:bg-background/88 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)]'
                                            )}
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                                                {option.emoji}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-base font-semibold text-foreground sm:text-[1.05rem]">
                                                    {option.label}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                    <Check className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </m.div>
                    ) : (
                        <m.div
                            key="vibe-review"
                            custom={direction}
                            initial={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? 18 : -18 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                            exit={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? -18 : 18 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="rounded-[1.75rem] border border-border/50 bg-card/88 p-4 shadow-[0_24px_72px_-56px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:p-5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                                        Review
                                    </div>
                                    <h3 className="mt-1.5 text-[1.35rem] font-black tracking-tight text-foreground sm:text-[1.6rem]">
                                        You&apos;re all set
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        We&apos;ll use these answers to build your first crew.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => jumpToStep(QUESTIONS.length - 1)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/72 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back
                                </button>
                            </div>

                            <div className="mt-3.5 space-y-2">
                                {QUESTIONS.map((question, index) => {
                                    const selectedOption = question.options.find((option) => option.value === answers[question.key])
                                    if (!selectedOption) return null

                                    return (
                                        <div
                                            key={question.key}
                                            className="flex w-full items-center gap-3 rounded-[1.15rem] border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-3 text-left"
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                                                {selectedOption.emoji}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                                                    {question.reviewLabel}
                                                </div>
                                                <div className="mt-1 text-base font-semibold text-foreground">
                                                    {selectedOption.label}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => jumpToStep(index)}
                                                className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/72 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-primary/30"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            <Button
                                className="mt-4 w-full rounded-[1.15rem] py-5 text-base font-semibold"
                                disabled={!allAnswered}
                                onClick={handleSubmit}
                                data-testid="vibe-quiz-next"
                            >
                                Confirm and continue
                            </Button>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        </m.section>
    )
}
