'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

interface BackgroundBlobsProps {
    isMuted?: boolean
}

export function BackgroundBlobs({ isMuted = false }: BackgroundBlobsProps) {
    const reduceMotion = useReducedMotion()
    const [isLowEnd, setIsLowEnd] = useState(false)

    useEffect(() => {
        if (typeof navigator === 'undefined') return
        const memory = (navigator as any).deviceMemory || 0
        const cores = navigator.hardwareConcurrency || 0
        if ((memory && memory <= 4) || (cores && cores <= 4)) {
            setIsLowEnd(true)
        }
    }, [])

    const disableMotion = useMemo(() => reduceMotion || isMuted || isLowEnd, [reduceMotion, isMuted, isLowEnd])
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, 100, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full"
            />
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, -80, 0],
                    y: [0, 100, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 15,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/20 blur-[120px] rounded-full"
            />
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, 50, -50, 0],
                    y: [0, -50, 50, 0],
                    scale: [1, 1.3, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full"
            />
        </div>
    )
}
