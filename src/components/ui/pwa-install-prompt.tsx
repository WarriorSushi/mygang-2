'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const DISMISS_KEY = 'pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (localStorage.getItem(DISMISS_KEY)) return

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            setVisible(true)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const dismiss = useCallback(() => {
        setVisible(false)
        localStorage.setItem(DISMISS_KEY, '1')
    }, [])

    const install = useCallback(async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') dismiss()
        setDeferredPrompt(null)
    }, [deferredPrompt, dismiss])

    if (!visible) return null

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-lg shadow-black/10 dark:shadow-black/30 px-4 py-2.5">
                <Download className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground/90 whitespace-nowrap">Install MyGang for quick access</span>
                <button
                    onClick={install}
                    className="rounded-full bg-primary px-4 py-1.5 min-h-[44px] text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    Install
                </button>
                <button
                    onClick={dismiss}
                    className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Dismiss install prompt"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}
