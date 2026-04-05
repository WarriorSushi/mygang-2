'use client'

import { useMemo } from 'react'
import { MultiStepLoader } from '@/components/ui/multi-step-loader'
import type { PendingArrivalContext } from '@/lib/chat-arrival'

interface LoadingStepProps {
    arrivalContext: PendingArrivalContext
}

export const LOADING_STEP_DURATION_MS = 1600

export function buildLoadingStates(arrivalContext: PendingArrivalContext) {
    const names = arrivalContext.squad.map((c) => c.displayName)
    const userName = arrivalContext.userName
    const first = names[0] ?? 'your crew'
    const second = names[1]
    const third = names[2]
    const allNames = names.length > 1
        ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
        : first

    const steps = [
        { text: `okay, this is actually happening` },
        { text: `your gang is on their way` },
        { text: `${first} just got the message` },
    ]

    if (second) steps.push({ text: `${second} is already excited` })
    if (third) steps.push({ text: `${third} just walked in` })

    steps.push(
        { text: `setting up your private room` },
        { text: `${allNames} are waiting for you` },
        { text: userName ? `they already know your name, ${userName}` : `they already know your name` },
        { text: `these friendships are about to feel very real` },
        { text: `they'll remember everything you tell them` },
        { text: `they're going to have opinions about each other too` },
        { text: `your gang chat is ready` },
        { text: `let's go 🎉` },
    )

    return steps
}

export function LoadingStep({ arrivalContext }: LoadingStepProps) {
    const loadingStates = useMemo(() => buildLoadingStates(arrivalContext), [arrivalContext])

    return (
        <MultiStepLoader
            loadingStates={loadingStates}
            loading={true}
            duration={LOADING_STEP_DURATION_MS}
            loop={false}
        />
    )
}
