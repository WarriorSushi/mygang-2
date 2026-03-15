'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VibeProfile } from '@/lib/ai/character-recommendation'

interface VibeQuizStepProps {
    onNext: (vibe: VibeProfile) => void
}

type QuestionKey = 'primary_intent' | 'warmth_style' | 'chaos_level'

type QuestionDefinition = {
    key: QuestionKey
    title: string
    shortTitle: string
    eyebrow: string
    description: string
    accentText: string
    accentSurface: string
    accentGlow: string
    accentBorder: string
    options: { value: string; label: string; emoji: string; hint: string }[]
}

const QUESTIONS: QuestionDefinition[] = [
    {
        key: 'primary_intent',
        title: 'What do you want your gang to do for you first?',
        shortTitle: 'Crew mission',
        eyebrow: 'Question 1',
        description: 'Pick the feeling you want most the second the chat opens.',
        accentText: 'text-amber-200',
        accentSurface: 'from-amber-500/16 via-orange-500/10 to-transparent',
        accentGlow: 'bg-amber-400/16',
        accentBorder: 'border-amber-300/28',
        options: [
            { value: 'hype', label: 'Hype me up', emoji: '\u{1F525}', hint: 'Big confidence, main-character boost.' },
            { value: 'honest', label: 'Real talk', emoji: '\u{1F4AF}', hint: 'Tell me the truth, but with love.' },
            { value: 'humor', label: 'Make me laugh', emoji: '\u{1F602}', hint: 'Roasts, chaos, and instant mood lift.' },
            { value: 'chill', label: 'Chill vibes', emoji: '\u{1F30A}', hint: 'Soft energy and zero pressure.' },
        ],
    },
    {
        key: 'warmth_style',
        title: 'How should they talk to you when it gets real?',
        shortTitle: 'Tone check',
        eyebrow: 'Question 2',
        description: 'We will tune the crew voice around the energy you actually like.',
        accentText: 'text-emerald-200',
        accentSurface: 'from-emerald-500/16 via-teal-500/10 to-transparent',
        accentGlow: 'bg-emerald-400/16',
        accentBorder: 'border-emerald-300/28',
        options: [
            { value: 'warm', label: 'Warm and supportive', emoji: '\u{1F49B}', hint: 'Comforting, caring, and reassuring.' },
            { value: 'balanced', label: 'Balanced mix', emoji: '\u{2696}\u{FE0F}', hint: 'Sweet when needed, honest when it matters.' },
            { value: 'edgy', label: 'Unfiltered and sarcastic', emoji: '\u{1F525}', hint: 'Dry humor, bold takes, no babying.' },
        ],
    },
    {
        key: 'chaos_level',
        title: "What's the room feel like tonight?",
        shortTitle: 'Energy level',
        eyebrow: 'Question 3',
        description: 'This shapes how calm, playful, or delightfully unhinged the crew feels.',
        accentText: 'text-cyan-200',
        accentSurface: 'from-cyan-500/16 via-sky-500/10 to-transparent',
        accentGlow: 'bg-cyan-400/16',
        accentBorder: 'border-cyan-300/28',
        options: [
            { value: 'calm', label: 'Keep it chill', emoji: '\u{2615}', hint: 'Grounded, slow, and easy to sink into.' },
            { value: 'lively', label: 'Lively and fun', emoji: '\u{26A1}', hint: 'Playful energy with momentum.' },
            { value: 'chaotic', label: 'Pure chaos', emoji: '\u{1F4A5}', hint: 'Messy, loud, and way too entertaining.' },
        ],
    },
]

const QUESTION_TRANSITION_MS = 180

export function VibeQuizStep({ onNext }: VibeQuizStepProps) {
    const prefersReducedMotion = useReducedMotion()
    const [answers, setAnswers] = useState<Partial<Record<QuestionKey, string>>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [direction, setDirection] = useState(1)
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const isReviewStep = currentIndex >= QUESTIONS.length
    const currentQuestion = QUESTIONS[Math.min(currentIndex, QUESTIONS.length - 1)]
    const allAnswered = QUESTIONS.every((question) => answers[question.key])
    const progressValue = isReviewStep
        ? 100
        : ((currentIndex + 1) / QUESTIONS.length) * 100

    useEffect(() => {
        return () => {
            if (advanceTimerRef.current) {
                clearTimeout(advanceTimerRef.current)
            }
        }
    }, [])

    const scheduleStepAdvance = (nextIndex: number) => {
        if (advanceTimerRef.current) {
            clearTimeout(advanceTimerRef.current)
        }

        if (prefersReducedMotion) {
            setCurrentIndex(nextIndex)
            return
        }

        advanceTimerRef.current = setTimeout(() => {
            setCurrentIndex(nextIndex)
            advanceTimerRef.current = null
        }, QUESTION_TRANSITION_MS)
    }

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
        if (nextIndex === QUESTIONS.length) {
            if (advanceTimerRef.current) {
                clearTimeout(advanceTimerRef.current)
                advanceTimerRef.current = null
            }
            setCurrentIndex(nextIndex)
            return
        }

        scheduleStepAdvance(nextIndex)
    }

    const handleSubmit = () => {
        if (!allAnswered) return
        onNext(answers as VibeProfile)
    }

    return (
        <m.section
            key="vibe-quiz"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 18 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto flex w-full max-w-5xl flex-col px-1 pb-6 pt-8 sm:pb-8 sm:pt-10"
            data-testid="onboarding-vibe-quiz-step"
        >
            <div className="mx-auto max-w-2xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    About 10 seconds
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">Set the vibe</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    One quick question at a time so matching feels effortless, not like homework.
                </p>
            </div>

            <div className="mx-auto mt-6 w-full max-w-3xl">
                <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground/70">
                    <span>{isReviewStep ? 'Review' : `${currentQuestion.eyebrow} of ${QUESTIONS.length}`}</span>
                    <span>{isReviewStep ? 'Ready to build the crew' : 'Three taps and done'}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 transition-[width] duration-300 ease-out"
                        style={{ width: `${progressValue}%` }}
                    />
                </div>
            </div>

            <div className="mx-auto mt-5 flex w-full max-w-3xl flex-wrap justify-center gap-2.5">
                {QUESTIONS.map((question, index) => {
                    const selectedOption = question.options.find((option) => option.value === answers[question.key])
                    const isCurrent = !isReviewStep && index === currentIndex

                    return (
                        <button
                            key={question.key}
                            type="button"
                            onClick={() => selectedOption && jumpToStep(index)}
                            disabled={!selectedOption}
                            className={cn(
                                'rounded-full border px-3 py-2 text-left transition-all duration-200',
                                selectedOption
                                    ? 'border-border/60 bg-card/70 text-foreground hover:border-primary/35 hover:bg-card'
                                    : 'border-border/30 bg-card/30 text-muted-foreground/45',
                                isCurrent && 'border-primary/45 bg-primary/10 text-foreground'
                            )}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                                {question.shortTitle}
                            </div>
                            <div className="mt-1 text-sm font-semibold">
                                {selectedOption ? selectedOption.label : 'Waiting for your pick'}
                            </div>
                        </button>
                    )
                })}
            </div>

            <div className="mx-auto mt-6 w-full max-w-3xl">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                    {!isReviewStep ? (
                        <m.div
                            key={currentQuestion.key}
                            custom={direction}
                            initial={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? 28 : -28, scale: 0.98 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0, scale: 1 }}
                            exit={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? -28 : 28, scale: 0.98 }}
                            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                            className="relative overflow-hidden rounded-[2rem] border border-border/45 bg-card/70 p-5 shadow-[0_30px_120px_-58px_rgba(2,6,23,0.9)] backdrop-blur-2xl sm:p-7"
                        >
                            <div className={cn('absolute inset-0 bg-gradient-to-br', currentQuestion.accentSurface)} />
                            <div className={cn('absolute -right-10 top-0 h-36 w-36 rounded-full blur-3xl', currentQuestion.accentGlow)} />
                            <div className="relative">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className={cn('text-[11px] font-bold uppercase tracking-[0.28em]', currentQuestion.accentText)}>
                                            {currentQuestion.eyebrow}
                                        </div>
                                        <h3 className="mt-3 max-w-2xl text-2xl font-black tracking-tight text-foreground sm:text-[2rem]">
                                            {currentQuestion.title}
                                        </h3>
                                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                            {currentQuestion.description}
                                        </p>
                                    </div>
                                    {currentIndex > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => jumpToStep(currentIndex - 1)}
                                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            <ArrowLeft className="h-3.5 w-3.5" />
                                            Back
                                        </button>
                                    )}
                                </div>

                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    {currentQuestion.options.map((option, index) => {
                                        const isSelected = answers[currentQuestion.key] === option.value
                                        const isLastOddCard = currentQuestion.options.length % 2 === 1 && index === currentQuestion.options.length - 1

                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => handleSelect(currentQuestion.key, option.value)}
                                                className={cn(
                                                    'group relative overflow-hidden rounded-[1.6rem] border p-4 text-left transition-all duration-200 active:scale-[0.99] sm:p-5',
                                                    'bg-background/72 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.95)]',
                                                    isSelected
                                                        ? cn('border-primary/50 bg-primary/12 ring-2 ring-primary/18')
                                                        : cn('border-border/45 hover:-translate-y-0.5 hover:border-primary/28 hover:bg-background/88'),
                                                    isLastOddCard && currentQuestion.options.length === 3 && 'sm:col-span-2'
                                                )}
                                                data-testid={`vibe-${currentQuestion.key}-${option.value}`}
                                            >
                                                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200 group-hover:opacity-100', currentQuestion.accentSurface)} />
                                                <div className="relative flex items-start gap-4">
                                                    <div className={cn(
                                                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl',
                                                        isSelected
                                                            ? cn('border-primary/30 bg-primary/18')
                                                            : cn(currentQuestion.accentBorder, 'bg-white/5')
                                                    )}>
                                                        <span aria-hidden="true">{option.emoji}</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-base font-bold text-foreground sm:text-lg">{option.label}</p>
                                                            {isSelected && (
                                                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground/90">
                                                            {option.hint}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </m.div>
                    ) : (
                        <m.div
                            key="vibe-review"
                            custom={direction}
                            initial={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? 28 : -28, scale: 0.98 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0, scale: 1 }}
                            exit={prefersReducedMotion ? {} : { opacity: 0, x: direction > 0 ? -28 : 28, scale: 0.98 }}
                            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                            className="relative overflow-hidden rounded-[2rem] border border-border/45 bg-card/70 p-5 shadow-[0_30px_120px_-58px_rgba(2,6,23,0.9)] backdrop-blur-2xl sm:p-7"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_38%)]" />
                            <div className="relative">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-200">
                                            <Check className="h-3.5 w-3.5" />
                                            Locked in
                                        </div>
                                        <h3 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-[2rem]">
                                            Your vibe recipe is ready
                                        </h3>
                                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                                            We&apos;ll use these answers to recommend the crew that feels right immediately, then you can still swap people later.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => jumpToStep(QUESTIONS.length - 1)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/70 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                </div>

                                <div className="mt-6 space-y-3">
                                    {QUESTIONS.map((question, index) => {
                                        const selectedOption = question.options.find((option) => option.value === answers[question.key])
                                        if (!selectedOption) return null

                                        return (
                                            <button
                                                key={question.key}
                                                type="button"
                                                onClick={() => jumpToStep(index)}
                                                className="flex w-full items-center justify-between gap-3 rounded-[1.4rem] border border-border/50 bg-background/72 px-4 py-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-background/86"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-xl">
                                                        {selectedOption.emoji}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                                                            {question.shortTitle}
                                                        </div>
                                                        <p className="truncate text-base font-semibold text-foreground">
                                                            {selectedOption.label}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                                    Change
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>

                                <Button
                                    className="mt-6 w-full rounded-[1.6rem] py-6 text-base font-black shadow-[0_28px_80px_-42px_rgba(16,185,129,0.85)] sm:py-7 sm:text-lg"
                                    disabled={!allAnswered}
                                    onClick={handleSubmit}
                                    data-testid="vibe-quiz-next"
                                >
                                    Find my crew
                                </Button>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        </m.section>
    )
}
