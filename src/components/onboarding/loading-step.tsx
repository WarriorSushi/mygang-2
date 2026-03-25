'use client'

import { m, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { LottieLoader } from '@/components/ui/lottie-loader'

const STATUS_MESSAGES = [
    "Waking up Rico...",
    "Nyx is loading her sarcasm module...",
    "Atlas is checking the parameter safety...",
    "Luna is aligning the vibes...",
    "Cleo is checking her makeup...",
    "Ezra is finding the right quote...",
    "Vee is drafting a dangerously sweet text...",
    "Kael is prepping the lighting..."
]

export function LoadingStep() {
    const [status, setStatus] = useState(STATUS_MESSAGES[0])
    const prefersReducedMotion = useReducedMotion()
    const showReducedMotionStatus = useCallback(() => setStatus('Summoning your gang...'), [])

    useEffect(() => {
        if (prefersReducedMotion) {
            queueMicrotask(showReducedMotionStatus)
            return
        }
        const interval = setInterval(() => {
            setStatus(current => {
                const currentIndex = STATUS_MESSAGES.indexOf(current)
                return STATUS_MESSAGES[(currentIndex + 1) % STATUS_MESSAGES.length]
            })
        }, 1200)
        return () => clearInterval(interval)
    }, [prefersReducedMotion, showReducedMotionStatus])

    return (
        <m.div
            key="loading"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center my-auto"
        >
            <div className="mx-auto mb-10">
                <div className="w-[140px] h-[140px] sm:w-[120px] sm:h-[120px]">
                    <LottieLoader size={140} className="mx-auto sm:!w-[120px] sm:!h-[120px]" />
                </div>
            </div>

            <h2 className="text-4xl font-bold mb-6 tracking-tight">Summoning the gang...</h2>
            <div className="h-8 flex items-center justify-center">
                <p className={`text-xl text-muted-foreground font-medium transition-all duration-300${prefersReducedMotion ? '' : ' animate-pulse'}`}>
                    {status}
                </p>
            </div>
        </m.div>
    )
}
