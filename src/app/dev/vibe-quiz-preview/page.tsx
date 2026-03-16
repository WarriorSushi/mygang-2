'use client'

import { VibeQuizStep } from '@/components/onboarding/vibe-quiz-step'

export default function VibeQuizPreviewPage() {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
        return null
    }

    return (
        <main id="main-content" className="min-h-dvh bg-background px-4 py-8 text-foreground">
            <VibeQuizStep onNext={() => {}} />
        </main>
    )
}
