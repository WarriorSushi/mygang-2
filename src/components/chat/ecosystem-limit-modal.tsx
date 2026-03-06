'use client'

interface EcosystemLimitModalProps {
    open: boolean
    onClose: () => void
}

export function EcosystemLimitModal({ open, onClose }: EcosystemLimitModalProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 border border-border"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Switching to Gang Focus</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        To keep things free, we limit ecosystem mode to the first few messages each session.
                        Your gang will still talk to you -- the only difference is they won&apos;t chat among themselves autonomously.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Upgrade anytime for unlimited ecosystem mode!
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        Got it!
                    </button>
                    <a
                        href="/pricing?upgrade=pro"
                        className="w-full py-2.5 text-center text-sm font-medium text-primary hover:underline"
                    >
                        See upgrade options
                    </a>
                </div>
            </div>
        </div>
    )
}
