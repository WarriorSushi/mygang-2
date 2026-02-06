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
    const [name, setName] = useState('')
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
    }, [])

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
        }, 3600)
    }

    return (
        <main
            className={cn(
                "h-dvh flex flex-col relative bg-background pt-safe pb-safe",
                isSelection
                    ? "items-stretch justify-start overflow-y-auto p-4 sm:p-6"
                    : "items-center justify-center overflow-hidden p-6"
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
                onSuccess={() => setShowAuthWall(false)}
            />
        </main>
    )
}
