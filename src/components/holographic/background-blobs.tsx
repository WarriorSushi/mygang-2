'use client'

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

/**
 * Pure CSS animated background blobs — zero JS per frame.
 * 3 large blobs with GPU-composited CSS keyframe animations.
 */
export function BackgroundBlobs({ isMuted = false, className }: BackgroundBlobsProps) {
    const [isLowEnd] = useState(detectLowEndDevice)
    const disableMotion = useMemo(() => isMuted || isLowEnd, [isMuted, isLowEnd])

    return (
        <div className={cn("fixed inset-0 -z-10 overflow-hidden pointer-events-none", className)}>
            {/* Primary blob — top-left drift */}
            <div
                className={cn(
                    "absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full will-change-transform",
                    "bg-primary/20 blur-[100px]",
                    !disableMotion && "animate-blob-drift-1"
                )}
            />
            {/* Accent blob — bottom-right drift */}
            <div
                className={cn(
                    "absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full will-change-transform",
                    "bg-accent/18 blur-[100px]",
                    !disableMotion && "animate-blob-drift-2"
                )}
            />
            {/* Blue blob — mid-right wander */}
            <div
                className={cn(
                    "absolute top-[22%] right-[8%] w-[30%] h-[30%] rounded-full will-change-transform",
                    "bg-blue-500/10 blur-[90px]",
                    !disableMotion && "animate-blob-drift-3"
                )}
            />
            {/* Film grain overlay — CSS noise */}
            <div className="absolute inset-0 landing-grain" />
        </div>
    )
}
