'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface InlineToastProps {
    message: string | null
    onClose: () => void
    severity?: 'info' | 'error'
}

export function InlineToast({ message, onClose, severity = 'info' }: InlineToastProps) {
    useEffect(() => {
        if (!message) return
        const timer = setTimeout(onClose, 4000)
        return () => clearTimeout(timer)
    }, [message, onClose])

    if (!message) return null

    return (
        <div className="fixed bottom-24 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2" role="alert" aria-live={severity === 'error' ? 'assertive' : 'polite'}>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-[11px] text-white shadow-2xl backdrop-blur-xl">
                <span>{message}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 rounded-full text-white/70 hover:text-white shrink-0"
                    aria-label="Dismiss notification"
                >
                    <X size={14} />
                </Button>
            </div>
        </div>
    )
}
