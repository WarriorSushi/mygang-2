'use client'

interface RateLimitMessageActionProps {
    cooldownSeconds?: number
}

export function RateLimitMessageAction({ cooldownSeconds }: RateLimitMessageActionProps) {
    return (
        <div className="flex flex-col gap-1 mt-1">
            {cooldownSeconds != null && cooldownSeconds > 0 && (
                <span className="text-xs text-muted-foreground">
                    Wait {Math.ceil(cooldownSeconds / 60)} min
                </span>
            )}
            <a
                href="/pricing?upgrade=pro"
                className="text-xs font-medium text-primary hover:underline"
            >
                or upgrade for unlimited messages + memory
            </a>
        </div>
    )
}
