'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface InlineToastProps {
    message: string | null
    onClose: () => void
    severity?: 'info' | 'error'
    action?: { label: string; onClick: () => void } | null
}

export function InlineToast({ message, onClose, severity = 'info', action = null }: InlineToastProps) {
    useEffect(() => {
        if (!message) return
        const timer = setTimeout(onClose, action ? 8000 : 4000)
        return () => clearTimeout(timer)
    }, [message, onClose, action])

    if (!message) return null

    return (
        <div className="fixed bottom-28 sm:bottom-24 left-1/2 z-[55] w-[90%] max-w-md -translate-x-1/2" role="alert" aria-live={severity === 'error' ? 'assertive' : 'polite'}>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-background/90 px-4 py-3 text-[11px] text-foreground dark:text-white shadow-2xl backdrop-blur-xl">
                <span>{message}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                    {action && (
                        <button
                            type="button"
                            onClick={action.onClick}
                            className="rounded-full px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                        >
                            {action.label}
                        </button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-9 w-9 rounded-full text-foreground/70 dark:text-white/70 hover:text-foreground dark:hover:text-white shrink-0"
                        aria-label="Dismiss notification"
                    >
                        <X size={14} />
                    </Button>
                </div>
            </div>
        </div>
    )
}
