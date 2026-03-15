'use client'

import type { ReactNode } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MovingBorderProps {
    children: ReactNode
    className?: string
    borderClassName?: string
    duration?: number
}

export function MovingBorder({
    children,
    className,
    borderClassName,
    duration = 4,
}: MovingBorderProps) {
    const prefersReducedMotion = useReducedMotion()

    return (
        <div className={cn('relative overflow-hidden', className)}>
            <m.div
                aria-hidden
                className={cn(
                    'pointer-events-none absolute inset-[-135%] opacity-95',
                    borderClassName ??
                        'bg-[conic-gradient(from_90deg_at_50%_50%,rgba(16,185,129,0)_0deg,rgba(16,185,129,0.2)_120deg,rgba(45,212,191,1)_180deg,rgba(16,185,129,0.22)_240deg,rgba(16,185,129,0)_360deg)]'
                )}
                animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                transition={
                    prefersReducedMotion
                        ? undefined
                        : {
                              duration,
                              ease: 'linear',
                              repeat: Infinity,
                          }
                }
            />
            <div className="relative h-full">{children}</div>
        </div>
    )
}
