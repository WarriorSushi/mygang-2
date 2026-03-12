'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { completeOnboarding } from '@/app/auth/actions'
import { CHARACTERS } from '@/constants/characters'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { useChatStore } from '@/stores/chat-store'
import { useRouter, useSearchParams } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { trackOperationalError } from '@/lib/operational-telemetry'
import { cn } from '@/lib/utils'
import { recommendCharacters } from '@/lib/ai/character-recommendation'
import type { VibeProfile } from '@/lib/ai/character-recommendation'

// Modular components
import { WelcomeStep } from '@/components/onboarding/welcome-step'
import { IdentityStep } from '@/components/onboarding/identity-step'
import { VibeQuizStep } from '@/components/onboarding/vibe-quiz-step'
import { SelectionStep } from '@/components/onboarding/selection-step'
import { FriendsIntroStep } from '@/components/onboarding/friends-intro-step'
import { LoadingStep } from '@/components/onboarding/loading-step'

type Step = 'WELCOME' | 'IDENTITY' | 'VIBE_QUIZ' | 'SELECTION' | 'INTRO' | 'LOADING'

const PROGRESS_STEPS: Step[] = ['WELCOME', 'IDENTITY', 'VIBE_QUIZ', 'SELECTION', 'INTRO', 'LOADING']

const BACK_MAP: Partial<Record<Step, Step>> = {
    IDENTITY: 'WELCOME',
    VIBE_QUIZ: 'IDENTITY',
    SELECTION: 'VIBE_QUIZ',
    INTRO: 'SELECTION',
}

function StepProgress({ current }: { current: Step }) {
    if (current === 'LOADING') return null
    const currentIndex = PROGRESS_STEPS.indexOf(current)
    return (
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {PROGRESS_STEPS.slice(0, -1).map((step, i) => (
                <div
                    key={step}
                    className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        i < currentIndex
                            ? "bg-primary"
                            : i === currentIndex
                                ? "bg-primary scale-125"
                                : "bg-muted-foreground/30"
                    )}
                    aria-label={`Step ${i + 1}${i === currentIndex ? ' (current)' : i < currentIndex ? ' (completed)' : ''}`}
                />
            ))}
        </div>
    )
}

export default function OnboardingPageWrapper() {
    return (
        <Suspense>
            <OnboardingPage />
        </Suspense>
    )
}

function OnboardingPage() {
    const searchParams = useSearchParams()
    const isRetake = searchParams.get('retake') === 'true'

    const [step, setStep] = useState<Step>(isRetake ? 'VIBE_QUIZ' : 'WELCOME')
    const [name, setName] = useState(() => useChatStore.getState().userName ?? '')
    const [selectedIds, setSelectedIds] = useState<string[]>(() =>
        isRetake ? useChatStore.getState().activeGang.map(c => c.id) : []
    )
    const [customNames, setCustomNames] = useState<Record<string, string>>(() => useChatStore.getState().customCharacterNames ?? {})
    const [vibeProfile, setVibeProfile] = useState<VibeProfile | null>(null)
    const [recommendedIds, setRecommendedIds] = useState<string[]>([])
    const setUserName = useChatStore((s) => s.setUserName)
    const setActiveGang = useChatStore((s) => s.setActiveGang)
    const setCustomCharacterNames = useChatStore((s) => s.setCustomCharacterNames)
    const userId = useChatStore((s) => s.userId)
    const activeGang = useChatStore((s) => s.activeGang)
    const isHydrated = useChatStore((s) => s.isHydrated)
    const router = useRouter()
    const isSelection = step === 'SELECTION'

    // Auth guard: redirect to landing if not authenticated
    useEffect(() => {
        if (isHydrated && !userId) {
            router.replace('/')
        }
    }, [isHydrated, userId, router])

    // Bypass onboarding once squad exists locally — but NOT in retake mode
    useEffect(() => {
        if (isHydrated && !isRetake && activeGang.length >= 2) {
            router.replace('/chat')
        }
    }, [isHydrated, activeGang.length, router, isRetake])

    useEffect(() => {
        const session = ensureAnalyticsSession()
        if (session.isNew) {
            trackEvent('session_start', { sessionId: session.id, metadata: { source: 'onboarding' } })
        }
        trackEvent(isRetake ? 'vibe_retake_started' : 'onboarding_started', { sessionId: session.id })
        router.prefetch('/chat')
    }, [router, isRetake])

    const toggleCharacter = (id: string) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((i) => i !== id)
            }
            if (prev.length >= 4) {
                return prev
            }
            return [...prev, id]
        })
    }

    const normalizedCustomNames = useMemo(() => {
        const next: Record<string, string> = {}
        const selectedCharacters = CHARACTERS.filter((character) => selectedIds.includes(character.id))

        selectedCharacters.forEach((character) => {
            const trimmed = (customNames[character.id] || '').trim().slice(0, 30)
            if (trimmed && trimmed !== character.name) {
                next[character.id] = trimmed
            }
        })

        return next
    }, [customNames, selectedIds])

    const handleVibeComplete = (vibe: VibeProfile) => {
        setVibeProfile(vibe)
        const ranked = recommendCharacters(vibe)
        setRecommendedIds(ranked.slice(0, 4))
        // Pre-select top recommended characters on first-time onboarding only
        if (!isRetake && selectedIds.length === 0) {
            setSelectedIds(ranked.slice(0, 4))
        }
        setStep('SELECTION')
    }

    const handleSelectionDone = () => {
        setStep('INTRO')
    }

    const handleIntroNameChange = (characterId: string, nextName: string) => {
        setCustomNames((prev) => ({
            ...prev,
            [characterId]: nextName,
        }))
    }

    const handleFinishOnboarding = async () => {
        const selectedCharacters = CHARACTERS.filter((c) => selectedIds.includes(c.id))
        setActiveGang(selectedCharacters)
        setUserName(name)
        setCustomCharacterNames(normalizedCustomNames)
        setStep('LOADING')

        const session = ensureAnalyticsSession()
        trackEvent(isRetake ? 'vibe_retake_completed' : 'onboarding_completed', { sessionId: session.id })

        // Persist to cloud (if logged in) and show loading animation for at least 1.5s
        await Promise.all([
            userId ? (async () => {
                try {
                    await completeOnboarding({
                        username: name,
                        characterIds: selectedIds,
                        customCharacterNames: normalizedCustomNames,
                        vibeProfile: vibeProfile as unknown as Record<string, string> | undefined,
                    })
                } catch (err) {
                    console.error('Failed to auto-save to cloud:', err)
                    trackOperationalError('squad_write_failed', {
                        user_id: userId,
                        source_path: 'onboarding.finish',
                        squad_size: selectedIds.length,
                    }, err)
                }
            })() : Promise.resolve(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ])
        router.replace('/chat')
    }

    // In retake mode, only show vibe quiz → selection → intro → loading
    const showBackButton = isRetake
        ? step === 'SELECTION' || step === 'INTRO'
        : step === 'IDENTITY' || step === 'VIBE_QUIZ' || step === 'SELECTION' || step === 'INTRO'

    const handleBack = () => {
        const prev = BACK_MAP[step]
        if (prev) {
            // In retake mode, don't go back past VIBE_QUIZ
            if (isRetake && (prev === 'WELCOME' || prev === 'IDENTITY')) return
            setStep(prev)
        }
    }

    return (
        <main
            id="main-content"
            className={cn(
                "h-dvh flex flex-col relative bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]",
                isSelection
                    ? "items-stretch justify-start overflow-y-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)]"
                    : "items-center justify-center overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:pt-[calc(env(safe-area-inset-top)+2rem)]"
            )}
        >
            <BackgroundBlobs />

            <StepProgress current={step} />

            {showBackButton && (
                <button
                    type="button"
                    onClick={handleBack}
                    className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 z-20 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    aria-label="Go back"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Back
                </button>
            )}

            <LazyMotion features={domAnimation}>
                <AnimatePresence mode="wait" initial={false}>
                    {step === 'WELCOME' && (
                        <WelcomeStep onNext={() => setStep('IDENTITY')} />
                    )}

                    {step === 'IDENTITY' && (
                        <IdentityStep
                            name={name}
                            setName={setName}
                            onNext={() => setStep('VIBE_QUIZ')}
                        />
                    )}

                    {step === 'VIBE_QUIZ' && (
                        <VibeQuizStep onNext={handleVibeComplete} />
                    )}

                    {step === 'SELECTION' && (
                        <SelectionStep
                            selectedIds={selectedIds}
                            toggleCharacter={toggleCharacter}
                            onNext={handleSelectionDone}
                            recommendedIds={recommendedIds}
                        />
                    )}

                    {step === 'INTRO' && (
                        <FriendsIntroStep
                            selectedIds={selectedIds}
                            customNames={customNames}
                            onNameChange={handleIntroNameChange}
                            onNext={handleFinishOnboarding}
                            onSkip={handleFinishOnboarding}
                        />
                    )}

                    {step === 'LOADING' && (
                        <LoadingStep />
                    )}
                </AnimatePresence>
            </LazyMotion>

        </main>
    )
}
