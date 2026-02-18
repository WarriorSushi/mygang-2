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
    const interactive = !!onClick
    return (
        <div
            onClick={onClick}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            style={style}
            {...props}
            className={cn(
                "relative overflow-hidden rounded-2xl transition-all duration-300",
                variant === 'default' && "border border-border/40 bg-muted/40 backdrop-blur-xl hover:bg-muted/50",
                variant === 'user' && "bg-primary shadow-sm",
                variant === 'ai' && "backdrop-blur-xl dark:bg-white/5 bg-white/90 dark:border-white/8",
                className
            )}
        >
            {children}
        </div>
    )
}
