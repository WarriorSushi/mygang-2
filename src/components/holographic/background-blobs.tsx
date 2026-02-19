'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface BackgroundBlobsProps {
    isMuted?: boolean
    className?: string
}

type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number }

function detectLowEndDevice() {
    if (typeof navigator === 'undefined') return false
    const nav = navigator as NavigatorWithDeviceMemory
    const memory = nav.deviceMemory ?? 0
    const cores = nav.hardwareConcurrency || 0
    return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)
}

export function BackgroundBlobs({ isMuted = false, className }: BackgroundBlobsProps) {
    const reduceMotion = useReducedMotion()
    const [isLowEnd] = useState(detectLowEndDevice)

    const disableMotion = useMemo(() => reduceMotion || isMuted || isLowEnd, [reduceMotion, isMuted, isLowEnd])
    return (
        <div className={cn("fixed inset-0 -z-10 overflow-hidden pointer-events-none", className)}>
            {/* Top-left primary blob */}
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
            {/* Bottom-right accent blob */}
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
            {/* Mid-right blue blob */}
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
            {/* Mid-page cyan blob (covers "How It Works" / "Why It Feels Real" zone) */}
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, -60, 30, 0],
                    y: [0, 40, -30, 0],
                    scale: [1, 1.15, 0.95, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 22,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[38%] left-[5%] w-[40%] h-[30%] bg-cyan-500/[0.07] dark:bg-cyan-500/[0.05] blur-[130px] rounded-full"
            />
            {/* Lower-page fuchsia blob (covers Testimonials / FAQ zone) */}
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, 70, -40, 0],
                    y: [0, -30, 60, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 18,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[60%] right-[0%] w-[35%] h-[28%] bg-fuchsia-500/[0.06] dark:bg-fuchsia-500/[0.04] blur-[120px] rounded-full"
            />
            {/* Bottom emerald blob (covers final CTA / footer zone) */}
            <motion.div
                animate={disableMotion ? undefined : {
                    x: [0, 40, -60, 0],
                    y: [0, -50, 20, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={disableMotion ? undefined : {
                    duration: 28,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute top-[82%] left-[15%] w-[30%] h-[25%] bg-emerald-500/[0.05] dark:bg-emerald-500/[0.04] blur-[110px] rounded-full"
            />
            {/* Noise grain overlay */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '180px 180px',
                    opacity: 0.03,
                    mixBlendMode: 'overlay',
                }}
            />
        </div>
    )
}
