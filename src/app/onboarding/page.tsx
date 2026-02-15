'use client'

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CHARACTERS } from '@/constants/characters'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { useChatStore } from '@/stores/chat-store'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { AuthWall } from '@/components/orchestrator/auth-wall'
import { createClient } from '@/lib/supabase/client'
import { persistUserJourney } from '@/lib/supabase/client-journey'

// New modular components
import { WelcomeStep } from '@/components/onboarding/welcome-step'
import { IdentityStep } from '@/components/onboarding/identity-step'
import { SelectionStep } from '@/components/onboarding/selection-step'
import { LoadingStep } from '@/components/onboarding/loading-step'

type Step = 'WELCOME' | 'IDENTITY' | 'SELECTION' | 'LOADING'

const PROGRESS_STEPS: Step[] = ['WELCOME', 'IDENTITY', 'SELECTION', 'LOADING']

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

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('WELCOME')
    const [name, setName] = useState(() => useChatStore.getState().userName ?? '')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showAuthWall, setShowAuthWall] = useState(false)
    const { setUserName, setActiveGang, setIsGuest, userId, activeGang, isHydrated } = useChatStore()
    const router = useRouter()
    const isSelection = step === 'SELECTION'
    const supabase = useMemo(() => createClient(), [])

    // Bypass onboarding once squad exists locally
    useEffect(() => {
        if (isHydrated && activeGang.length > 0) {
            router.push('/chat')
        }
    }, [isHydrated, activeGang.length, router])

    useEffect(() => {
        const session = ensureAnalyticsSession()
        if (session.isNew) {
            trackEvent('session_start', { sessionId: session.id, metadata: { source: 'onboarding' } })
        }
        trackEvent('onboarding_started', { sessionId: session.id })
        router.prefetch('/chat')
    }, [router])

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

    const handleSelectionDone = async () => {
        const selectedCharacters = CHARACTERS.filter((c) => selectedIds.includes(c.id))
        setActiveGang(selectedCharacters)
        setUserName(name)
        setIsGuest(userId === null)
        setStep('LOADING')

        const session = ensureAnalyticsSession()
        trackEvent('onboarding_completed', { sessionId: session.id })

        // Persist to cloud if logged in
        if (userId) {
            try {
                await persistUserJourney(supabase, userId, {
                    username: name,
                    gangIds: selectedIds,
                    onboardingCompleted: true
                })
            } catch (err) {
                console.error('Failed to auto-save to cloud:', err)
            }
        }

        // Simulate summoning delay
        setTimeout(() => {
            router.push('/chat')
        }, 2200)
    }

    return (
        <main
            className={cn(
                "h-dvh flex flex-col relative bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]",
                isSelection
                    ? "items-stretch justify-start overflow-y-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)]"
                    : "items-center justify-center overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:pt-[calc(env(safe-area-inset-top)+2rem)]"
            )}
        >
            <BackgroundBlobs />

            <StepProgress current={step} />

            <AnimatePresence mode="wait" initial={false}>
                {step === 'WELCOME' && (
                    <WelcomeStep onNext={() => setStep('IDENTITY')} onLogin={() => setShowAuthWall(true)} />
                )}

                {step === 'IDENTITY' && (
                    <IdentityStep
                        name={name}
                        setName={setName}
                        onNext={() => setStep('SELECTION')}
                        onLogin={() => setShowAuthWall(true)}
                    />
                )}

                {step === 'SELECTION' && (
                    <SelectionStep
                        selectedIds={selectedIds}
                        toggleCharacter={toggleCharacter}
                        onNext={handleSelectionDone}
                    />
                )}

                {step === 'LOADING' && (
                    <LoadingStep />
                )}
            </AnimatePresence>

            <AuthWall
                isOpen={showAuthWall}
                onClose={() => setShowAuthWall(false)}
                onSuccess={() => {
                    setShowAuthWall(false)
                    router.push('/post-auth')
                }}
            />
        </main>
    )
}
