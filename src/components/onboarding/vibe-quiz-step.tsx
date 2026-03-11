'use client'

import { useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VibeProfile } from '@/lib/ai/character-recommendation'

interface VibeQuizStepProps {
    onNext: (vibe: VibeProfile) => void
}

type QuestionKey = 'primary_intent' | 'warmth_style' | 'chaos_level'

const QUESTIONS: {
    key: QuestionKey
    title: string
    options: { value: string; label: string; emoji: string }[]
}[] = [
    {
        key: 'primary_intent',
        title: 'What do you want from your gang?',
        options: [
            { value: 'hype', label: 'Hype me up', emoji: '\u{1F525}' },
            { value: 'honest', label: 'Real talk', emoji: '\u{1F4AF}' },
            { value: 'humor', label: 'Make me laugh', emoji: '\u{1F602}' },
            { value: 'chill', label: 'Chill vibes', emoji: '\u{1F30A}' },
        ],
    },
    {
        key: 'warmth_style',
        title: 'How should your friends talk to you?',
        options: [
            { value: 'warm', label: 'Warm & supportive', emoji: '\u{1F49B}' },
            { value: 'balanced', label: 'Balanced mix', emoji: '\u{2696}\u{FE0F}' },
            { value: 'edgy', label: 'Unfiltered & sarcastic', emoji: '\u{1F525}' },
        ],
    },
    {
        key: 'chaos_level',
        title: "What's the energy?",
        options: [
            { value: 'calm', label: 'Keep it chill', emoji: '\u{2615}' },
            { value: 'lively', label: 'Lively & fun', emoji: '\u{26A1}' },
            { value: 'chaotic', label: 'Pure chaos', emoji: '\u{1F4A5}' },
        ],
    },
]

export function VibeQuizStep({ onNext }: VibeQuizStepProps) {
    const prefersReducedMotion = useReducedMotion()
    const [answers, setAnswers] = useState<Partial<Record<QuestionKey, string>>>({})

    const allAnswered = QUESTIONS.every(q => answers[q.key])

    const handleSelect = (key: QuestionKey, value: string) => {
        setAnswers(prev => ({ ...prev, [key]: value }))
    }

    const handleSubmit = () => {
        if (!allAnswered) return
        onNext(answers as VibeProfile)
    }

    return (
        <m.div
            key="vibe-quiz"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            className="w-full max-w-md space-y-6"
        >
            <h2 className="text-2xl sm:text-3xl font-bold text-center">Set the vibe</h2>
            <p className="text-sm text-muted-foreground text-center">
                Quick picks to match you with the right crew
            </p>

            <div className="space-y-5">
                {QUESTIONS.map((q) => (
                    <div key={q.key} className="space-y-2">
                        <p className="text-sm font-medium text-foreground/80">{q.title}</p>
                        <div className="flex flex-wrap gap-2">
                            {q.options.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(q.key, opt.value)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.97]",
                                        "border",
                                        answers[q.key] === opt.value
                                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                                            : "bg-muted/40 text-foreground/70 border-border/50 hover:bg-muted/70"
                                    )}
                                    data-testid={`vibe-${q.key}-${opt.value}`}
                                >
                                    <span className="mr-1.5">{opt.emoji}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <Button
                className="w-full py-5 sm:py-7 rounded-2xl text-base sm:text-lg font-bold shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
                disabled={!allAnswered}
                onClick={handleSubmit}
                data-testid="vibe-quiz-next"
            >
                Find my crew
            </Button>
        </m.div>
    )
}
