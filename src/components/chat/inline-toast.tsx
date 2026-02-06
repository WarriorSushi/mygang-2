'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface InlineToastProps {
    message: string | null
    onClose: () => void
}

export function InlineToast({ message, onClose }: InlineToastProps) {
    if (!message) return null

    return (
        <div className="fixed bottom-24 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-[11px] text-white shadow-2xl backdrop-blur-xl">
                <span>{message}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-7 w-7 rounded-full text-white/70 hover:text-white"
                    aria-label="Dismiss notification"
                >
                    <X size={14} />
                </Button>
            </div>
        </div>
    )
}
