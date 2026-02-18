'use client'

import { useEffect } from 'react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Layout-level error:', error)
    }, [error])

    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0a0a', color: '#fafafa' }}>
                <div style={{ display: 'flex', minHeight: '100dvh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h1>
                    <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center', maxWidth: '28rem' }}>
                        A critical error occurred. Please try refreshing the page.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={reset}
                            style={{
                                borderRadius: '0.5rem',
                                background: '#6366f1',
                                padding: '0.625rem 1.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Try again
                        </button>
                        <a
                            href="/"
                            style={{
                                borderRadius: '0.5rem',
                                border: '1px solid #27272a',
                                padding: '0.625rem 1.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#fafafa',
                                textDecoration: 'none',
                            }}
                        >
                            Go home
                        </a>
                    </div>
                </div>
            </body>
        </html>
    )
}
