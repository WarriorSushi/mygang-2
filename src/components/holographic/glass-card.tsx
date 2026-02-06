'use client'

import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    className?: string
    onClick?: () => void
    style?: React.CSSProperties
    variant?: 'default' | 'user' | 'ai'
}

export function GlassCard({ children, className, onClick, style, variant = 'default', ...props }: GlassCardProps) {
    return (
        <div
            onClick={onClick}
            style={style}
            {...props}
            className={cn(
                "relative group overflow-hidden rounded-2xl border transition-all duration-500",
                // Default Glass
                variant === 'default' && "border-white/10 bg-white/5 backdrop-blur-xl hover:border-white/30 hover:bg-white/10",
                // User Bubble (Holographic Primary)
                variant === 'user' && "bg-primary border-primary/20 shadow-lg shadow-primary/20 hover:brightness-110",
                // AI Bubble (Dynamic Glass)
                variant === 'ai' && [
                    "backdrop-blur-xl border-white/10 hover:border-white/20",
                    "dark:bg-white/5",
                    "light:bg-white/90 light:border-black/10 light:shadow-sm"
                ],
                className
            )}
        >
            {/* Subtle inner glow (only for non-user) */}
            {variant !== 'user' && (
                <div className="absolute inset-px rounded-[inherit] border border-white/5 pointer-events-none -z-10" />
            )}
            {children}
        </div>
    )
}
