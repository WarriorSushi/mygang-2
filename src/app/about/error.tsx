'use client'

export default function AboutError({ reset }: { error: Error; reset: () => void }) {
    return (
        <div className="flex min-h-dvh items-center justify-center bg-background">
            <div className="text-center space-y-4 px-6">
                <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
                <p className="text-sm text-muted-foreground">Could not load this page.</p>
                <button
                    onClick={reset}
                    className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    )
}
