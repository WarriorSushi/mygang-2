'use client'

import { AvatarGiftStep } from '@/components/onboarding/avatar-gift-step'

export default function AvatarGiftPreviewPage() {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'development') {
        return null
    }

    return (
        <main id="main-content" className="min-h-dvh bg-background px-4 py-4 text-foreground">
            <AvatarGiftStep onNext={() => {}} />
        </main>
    )
}
