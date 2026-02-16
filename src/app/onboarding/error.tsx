'use client'

import { useEffect } from 'react'

export default function OnboardingError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Onboarding error:', error)
    }, [error])

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground px-6">
            <h1 className="text-xl font-semibold mb-2">Oops</h1>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                Something went wrong during setup. Let&apos;s try again.
            </p>
            <button
                onClick={reset}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
                Try again
            </button>
        </div>
    )
}
