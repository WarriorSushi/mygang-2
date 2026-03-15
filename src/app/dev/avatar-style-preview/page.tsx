'use client'

import { useState } from 'react'
import { AvatarStyleStep } from '@/components/onboarding/avatar-style-step'
import type { AvatarStyle } from '@/lib/avatar-style'

export default function AvatarStylePreviewPage() {
    const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>('retro')

    return (
        <main id="main-content" className="min-h-dvh bg-background px-4 py-4 text-foreground">
            <AvatarStyleStep
                selectedStyle={selectedStyle}
                onSelectStyle={setSelectedStyle}
                onNext={() => {}}
            />
        </main>
    )
}
