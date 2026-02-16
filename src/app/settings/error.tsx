'use client'

import { useEffect } from 'react'

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Settings error:', error)
    }, [error])

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground px-6">
            <h1 className="text-xl font-semibold mb-2">Settings error</h1>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                Could not load settings. Try refreshing.
            </p>
            <div className="flex gap-3">
                <button
                    onClick={reset}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                    Try again
                </button>
                <a
                    href="/chat"
                    className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                    Back to chat
                </a>
            </div>
        </div>
    )
}
