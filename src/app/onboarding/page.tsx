'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CHARACTERS } from '@/constants/characters'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { useChatStore } from '@/stores/chat-store'
import { useRouter } from 'next/navigation'
import { saveGang, saveUsername } from '@/app/auth/actions'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { AuthWall } from '@/components/orchestrator/auth-wall'

// New modular components
import { WelcomeStep } from '@/components/onboarding/welcome-step'
import { IdentityStep } from '@/components/onboarding/identity-step'
import { SelectionStep } from '@/components/onboarding/selection-step'
import { LoadingStep } from '@/components/onboarding/loading-step'

type Step = 'WELCOME' | 'IDENTITY' | 'SELECTION' | 'LOADING'

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('WELCOME')
    const [name, setName] = useState(() => useChatStore.getState().userName ?? '')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showAuthWall, setShowAuthWall] = useState(false)
    const { setUserName, setActiveGang, setIsGuest, userId, activeGang, isHydrated } = useChatStore()
    const router = useRouter()
    const isSelection = step === 'SELECTION'

    // Bypassing Onboarding if squad already exists
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

        // Save to DB if logged in
        if (userId) {
            try {
                await Promise.all([
                    saveGang(selectedIds),
                    saveUsername(name)
                ])
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
                    router.push('/chat')
                }}
            />
        </main>
    )
}
