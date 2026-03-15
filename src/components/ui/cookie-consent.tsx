'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'mygang-cookie-consent'

export function CookieConsent() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        try {
            const accepted = localStorage.getItem(STORAGE_KEY)
            if (!accepted) {
                setVisible(true)
            }
        } catch {
            // localStorage unavailable, don't show
        }
    }, [])

    if (!visible) return null

    const accept = () => {
        setVisible(false)
        try {
            localStorage.setItem(STORAGE_KEY, '1')
        } catch {
            // ignore
        }
    }

    return (
        <div className="fixed inset-x-0 top-auto bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-[60] p-4 pointer-events-none">
            <div className="mx-auto max-w-lg pointer-events-auto rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-lg px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                    We use essential cookies for authentication and app functionality. By continuing to use MyGang, you consent to our use of cookies.{' '}
                    <Link href="/privacy" className="underline text-primary/80 hover:text-primary">Learn more</Link>
                </p>
                <button
                    type="button"
                    onClick={accept}
                    className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    )
}
