'use client'

export default function SettingsError({ reset }: { reset: () => void }) {
    return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
                We couldn&apos;t load your settings. This is usually temporary.
            </p>
            <button
                onClick={reset}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
            >
                Try again
            </button>
        </div>
    )
}
