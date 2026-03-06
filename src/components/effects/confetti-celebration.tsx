'use client'

import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'

interface ConfettiCelebrationProps {
    trigger: boolean
    onComplete?: () => void
}

export function ConfettiCelebration({ trigger, onComplete }: ConfettiCelebrationProps) {
    const [animationData, setAnimationData] = useState<unknown>(null)
    const [show, setShow] = useState(false)

    useEffect(() => {
        if (!trigger) return
        setShow(true)
        // Lazy-load the animation JSON only when needed
        fetch('/lottie/confetti.json')
            .then((res) => res.json())
            .then(setAnimationData)
            .catch(() => {})
    }, [trigger])

    if (!show || !animationData) return null

    return (
        <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
            <Lottie
                animationData={animationData}
                loop={false}
                autoplay
                onComplete={() => {
                    setShow(false)
                    setAnimationData(null)
                    onComplete?.()
                }}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100vmax',
                    height: '100vmax',
                    minWidth: '100vw',
                    minHeight: '100vh',
                }}
            />
        </div>
    )
}
