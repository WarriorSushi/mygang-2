'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CHARACTERS } from '@/constants/characters'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { useChatStore } from '@/stores/chat-store'
import { useRouter } from 'next/navigation'
import { saveGang, saveUsername } from '@/app/auth/actions'

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
    const { setUserName, setActiveGang, setIsGuest, userId, activeGang, isHydrated } = useChatStore()
    const router = useRouter()

    // Bypassing Onboarding if squad already exists
    useEffect(() => {
        if (isHydrated && activeGang.length > 0) {
            router.push('/chat')
        }
    }, [isHydrated, activeGang.length, router])

    const toggleCharacter = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((i) => i !== id))
        } else if (selectedIds.length < 4) {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleSelectionDone = async () => {
        const selectedCharacters = CHARACTERS.filter((c) => selectedIds.includes(c.id))
        setActiveGang(selectedCharacters)
        setUserName(name)
        setIsGuest(userId === null)
        setStep('LOADING')

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
        <main className="h-dvh flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background">
            <BackgroundBlobs />

            <AnimatePresence mode="wait" initial={false}>
                {step === 'WELCOME' && (
                    <WelcomeStep onNext={() => setStep('IDENTITY')} />
                )}

                {step === 'IDENTITY' && (
                    <IdentityStep
                        name={name}
                        setName={setName}
                        onNext={() => setStep('SELECTION')}
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
        </main>
    )
}
