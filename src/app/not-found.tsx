import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground px-6">
            <h1 className="text-6xl font-bold mb-3 text-muted-foreground/40">404</h1>
            <h2 className="text-xl font-semibold mb-2">Page not found</h2>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                This page doesn&apos;t exist. Your gang is waiting for you in the chat.
            </p>
            <Link
                href="/"
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
                Back to MyGang
            </Link>
        </div>
    )
}
