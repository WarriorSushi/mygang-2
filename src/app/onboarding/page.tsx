'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, LazyMotion, domAnimation } from 'framer-motion'
import { completeOnboarding } from '@/app/auth/actions'
import { getCharactersForAvatarStyle } from '@/constants/characters'
import { getSquadLimit, getTierFromProfile } from '@/lib/billing'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { useChatStore } from '@/stores/chat-store'
import { useRouter, useSearchParams } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { trackOperationalError } from '@/lib/operational-telemetry'
import { cn } from '@/lib/utils'
import { recommendCharacters } from '@/lib/ai/character-recommendation'
import type { VibeProfile } from '@/lib/ai/character-recommendation'

import { WelcomeStep } from '@/components/onboarding/welcome-step'
import { IdentityStep } from '@/components/onboarding/identity-step'
import { VibeQuizStep } from '@/components/onboarding/vibe-quiz-step'
import { AvatarGiftStep } from '@/components/onboarding/avatar-gift-step'
import { AvatarStyleStep } from '@/components/onboarding/avatar-style-step'
import { SelectionStep } from '@/components/onboarding/selection-step'
import { FriendsIntroStep } from '@/components/onboarding/friends-intro-step'
import { LoadingStep } from '@/components/onboarding/loading-step'

type Step = 'WELCOME' | 'IDENTITY' | 'VIBE_QUIZ' | 'AVATAR_GIFT' | 'AVATAR_STYLE' | 'SELECTION' | 'INTRO' | 'LOADING'

const FIRST_TIME_PROGRESS_STEPS: Step[] = ['WELCOME', 'IDENTITY', 'VIBE_QUIZ', 'AVATAR_GIFT', 'AVATAR_STYLE', 'SELECTION', 'INTRO', 'LOADING']
const RETAKE_PROGRESS_STEPS: Step[] = ['VIBE_QUIZ', 'AVATAR_STYLE', 'SELECTION', 'INTRO', 'LOADING']

const FIRST_TIME_BACK_MAP: Partial<Record<Step, Step>> = {
    IDENTITY: 'WELCOME',
    VIBE_QUIZ: 'IDENTITY',
    AVATAR_GIFT: 'VIBE_QUIZ',
    AVATAR_STYLE: 'AVATAR_GIFT',
    SELECTION: 'AVATAR_STYLE',
    INTRO: 'SELECTION',
}

const RETAKE_BACK_MAP: Partial<Record<Step, Step>> = {
    AVATAR_STYLE: 'VIBE_QUIZ',
    SELECTION: 'AVATAR_STYLE',
    INTRO: 'SELECTION',
}

function StepProgress({ current, steps }: { current: Step; steps: Step[] }) {
    if (current === 'LOADING') return null

    const visibleSteps = steps.filter((step) => step !== 'LOADING')
    const currentIndex = visibleSteps.indexOf(current)

    return (
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.4rem)] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {visibleSteps.map((step, i) => (
                <div
                    key={step}
                    className={cn(
                        'h-2 w-2 rounded-full transition-all duration-300',
                        i < currentIndex
                            ? 'bg-primary'
                            : i === currentIndex
                                ? 'scale-125 bg-primary'
                                : 'bg-muted-foreground/30'
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
    const progressSteps = isRetake ? RETAKE_PROGRESS_STEPS : FIRST_TIME_PROGRESS_STEPS
    const backMap = isRetake ? RETAKE_BACK_MAP : FIRST_TIME_BACK_MAP

    const [step, setStep] = useState<Step>(isRetake ? 'VIBE_QUIZ' : 'WELCOME')
    const [name, setName] = useState(() => useChatStore.getState().userName ?? '')
    const [selectedIds, setSelectedIds] = useState<string[]>(() =>
        isRetake ? useChatStore.getState().activeGang.map((character) => character.id) : []
    )
    const [customNames, setCustomNames] = useState<Record<string, string>>(() => useChatStore.getState().customCharacterNames ?? {})
    const [vibeProfile, setVibeProfile] = useState<VibeProfile | null>(null)
    const [recommendedIds, setRecommendedIds] = useState<string[]>([])
    const avatarStylePreference = useChatStore((state) => state.avatarStylePreference)
    const setAvatarStylePreference = useChatStore((state) => state.setAvatarStylePreference)
    const setUserName = useChatStore((state) => state.setUserName)
    const setActiveGang = useChatStore((state) => state.setActiveGang)
    const setCustomCharacterNames = useChatStore((state) => state.setCustomCharacterNames)
    const userId = useChatStore((state) => state.userId)
    const activeGang = useChatStore((state) => state.activeGang)
    const isHydrated = useChatStore((state) => state.isHydrated)
    const subscriptionTier = useChatStore((state) => state.subscriptionTier)
    const squadLimit = getSquadLimit(getTierFromProfile(subscriptionTier ?? null))
    const router = useRouter()
    const characters = useMemo(() => getCharactersForAvatarStyle(avatarStylePreference), [avatarStylePreference])
    const isScrollableStep = step === 'SELECTION' || step === 'INTRO' || step === 'AVATAR_STYLE' || step === 'AVATAR_GIFT'

    useEffect(() => {
        if (isHydrated && !userId) {
            router.replace('/')
        }
    }, [isHydrated, router, userId])

    useEffect(() => {
        if (isHydrated && !isRetake && activeGang.length >= 2) {
            router.replace('/chat')
        }
    }, [activeGang.length, isHydrated, isRetake, router])

    useEffect(() => {
        const session = ensureAnalyticsSession()
        if (session.isNew) {
            trackEvent('session_start', { sessionId: session.id, metadata: { source: 'onboarding' } })
        }
        trackEvent(isRetake ? 'vibe_retake_started' : 'onboarding_started', { sessionId: session.id })
        router.prefetch('/chat')
    }, [isRetake, router])

    useEffect(() => {
        const session = ensureAnalyticsSession()

        if (step === 'AVATAR_GIFT' && !isRetake) {
            trackEvent('avatar_gift_viewed', {
                sessionId: session.id,
                metadata: { source: 'onboarding' },
            })
        }

        if (step === 'AVATAR_STYLE') {
            trackEvent('avatar_style_picker_viewed', {
                sessionId: session.id,
                metadata: {
                    source: isRetake ? 'retake' : 'onboarding',
                    avatar_style_preference: avatarStylePreference,
                },
            })
        }
    }, [isRetake, step])

    const toggleCharacter = (id: string) => {
        setSelectedIds((previous) => {
            if (previous.includes(id)) {
                return previous.filter((characterId) => characterId !== id)
            }
            if (previous.length >= squadLimit) {
                return previous // at max — do nothing (UI shows limit)
            }
            return [...previous, id]
        })
    }

    const normalizedCustomNames = useMemo(() => {
        const next: Record<string, string> = {}
        const selectedCharacters = characters.filter((character) => selectedIds.includes(character.id))

        selectedCharacters.forEach((character) => {
            const trimmed = (customNames[character.id] || '').trim().slice(0, 30)
            if (trimmed && trimmed !== character.name) {
                next[character.id] = trimmed
            }
        })

        return next
    }, [characters, customNames, selectedIds])

    const handleVibeComplete = (vibe: VibeProfile) => {
        setVibeProfile(vibe)
        const ranked = recommendCharacters(vibe)
        setRecommendedIds(ranked.slice(0, squadLimit))
        if (!isRetake && selectedIds.length === 0) {
            setSelectedIds(ranked.slice(0, squadLimit))
        }
        setStep(isRetake ? 'AVATAR_STYLE' : 'AVATAR_GIFT')
    }

    const handleAvatarStyleSelect = (style: 'robots' | 'human' | 'retro') => {
        setAvatarStylePreference(style)
        const session = ensureAnalyticsSession()
        trackEvent('avatar_style_selected', {
            sessionId: session.id,
            metadata: {
                source: isRetake ? 'retake' : 'onboarding',
                avatar_style_preference: style,
            },
        })
    }

    const handleSelectionDone = () => {
        setStep('INTRO')
    }

    const handleIntroNameChange = (characterId: string, nextName: string) => {
        setCustomNames((previous) => ({
            ...previous,
            [characterId]: nextName,
        }))
    }

    const handleFinishOnboarding = async () => {
        const selectedCharacters = characters.filter((character) => selectedIds.includes(character.id))
        setActiveGang(selectedCharacters)
        setAvatarStylePreference(avatarStylePreference)
        setUserName(name)
        setCustomCharacterNames(normalizedCustomNames)
        setStep('LOADING')

        const session = ensureAnalyticsSession()
        trackEvent(isRetake ? 'vibe_retake_completed' : 'onboarding_completed', {
            sessionId: session.id,
            metadata: {
                avatar_style_preference: avatarStylePreference,
            },
        })

        await Promise.all([
            userId ? (async () => {
                try {
                    await completeOnboarding({
                        username: name,
                        characterIds: selectedIds,
                        customCharacterNames: normalizedCustomNames,
                        vibeProfile: vibeProfile as unknown as Record<string, string> | undefined,
                        avatarStylePreference,
                    })
                } catch (error) {
                    console.error('Failed to auto-save to cloud:', error)
                    trackOperationalError('squad_write_failed', {
                        user_id: userId,
                        source_path: 'onboarding.finish',
                        squad_size: selectedIds.length,
                    }, error)
                }
            })() : Promise.resolve(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ])

        router.replace('/chat')
    }

    const showBackButton = isRetake
        ? step === 'AVATAR_STYLE' || step === 'SELECTION' || step === 'INTRO'
        : step === 'IDENTITY' || step === 'VIBE_QUIZ' || step === 'AVATAR_GIFT' || step === 'AVATAR_STYLE' || step === 'SELECTION' || step === 'INTRO'

    const handleBack = () => {
        const previousStep = backMap[step]
        if (previousStep) {
            if (isRetake && (previousStep === 'WELCOME' || previousStep === 'IDENTITY')) return
            setStep(previousStep)
        }
    }

    return (
        <main
            id="main-content"
            className={cn(
                'relative flex h-dvh flex-col bg-background overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]',
                isScrollableStep
                    ? 'items-stretch justify-start px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1rem)]'
                    : 'items-center px-6 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)]'
            )}
        >
            <BackgroundBlobs />

            <StepProgress current={step} steps={progressSteps} />

            {showBackButton && (
                <button
                    type="button"
                    onClick={handleBack}
                    className="absolute top-[calc(env(safe-area-inset-top)+0.4rem)] left-4 z-20 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Go back"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
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

                    {step === 'AVATAR_GIFT' && (
                        <AvatarGiftStep onNext={() => setStep('AVATAR_STYLE')} />
                    )}

                    {step === 'AVATAR_STYLE' && (
                        <AvatarStyleStep
                            selectedStyle={avatarStylePreference}
                            onSelectStyle={handleAvatarStyleSelect}
                            onNext={() => setStep('SELECTION')}
                        />
                    )}

                    {step === 'SELECTION' && (
                        <SelectionStep
                            characters={characters}
                            selectedIds={selectedIds}
                            toggleCharacter={toggleCharacter}
                            onNext={handleSelectionDone}
                            recommendedIds={recommendedIds}
                            maxMembers={squadLimit}
                        />
                    )}

                    {step === 'INTRO' && (
                        <FriendsIntroStep
                            characters={characters}
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
