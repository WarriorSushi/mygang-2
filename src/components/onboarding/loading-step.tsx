'use client'

import { useMemo } from 'react'
import { MultiStepLoader } from '@/components/ui/multi-step-loader'
import type { PendingArrivalContext } from '@/lib/chat-arrival'

interface LoadingStepProps {
    arrivalContext: PendingArrivalContext
}

export function LoadingStep({ arrivalContext }: LoadingStepProps) {
    const loadingStates = useMemo(() => {
        const names = arrivalContext.squad.map((c) => c.displayName)
        const first = names[0] ?? 'your crew'
        const second = names[1]

        const steps = [
            { text: `Calling ${first} in` },
        ]

        if (second) steps.push({ text: `${second} just arrived` })

        steps.push(
            { text: 'Setting up your private room' },
            { text: 'Your gang is ready' },
        )

        return steps
    }, [arrivalContext.squad])

    return (
        <MultiStepLoader
            loadingStates={loadingStates}
            loading={true}
            duration={1800}
            loop={false}
        />
    )
}
