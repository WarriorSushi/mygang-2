'use client'

/**
 * MetaPixel — loads the Pixel base script and fires PageView on SPA navigations.
 *
 * Mount once in layout.tsx inside <body>.
 * Reads NEXT_PUBLIC_META_PIXEL_ID at build time.
 */

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

// Inner component that uses useSearchParams (must be wrapped in Suspense)
function MetaPixelEvents() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        if (typeof window === 'undefined' || !window.fbq) return
        window.fbq('track', 'PageView')
    }, [pathname, searchParams])

    return null
}

export function MetaPixel() {
    if (!PIXEL_ID) return null

    return (
        <>
            <Script
                id="meta-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');
`,
                }}
            />
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: 'none' }}
                    src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
            <Suspense fallback={null}>
                <MetaPixelEvents />
            </Suspense>
        </>
    )
}

// ---------------------------------------------------------------------------
// Client-side event helpers — call these from client components
// ---------------------------------------------------------------------------

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void
    }
}

/** Fire a standard Pixel event. Pass eventID for dedup with CAPI. */
export function pixelTrack(eventName: string, params?: Record<string, unknown>, eventID?: string) {
    if (typeof window === 'undefined' || !window.fbq) return
    if (eventID) {
        window.fbq('track', eventName, params ?? {}, { eventID })
    } else {
        window.fbq('track', eventName, params ?? {})
    }
}

/** Read _fbp / _fbc cookies — pass these to CAPI calls for better matching. */
export function getMetaCookies(): { fbp: string | null; fbc: string | null } {
    if (typeof document === 'undefined') return { fbp: null, fbc: null }
    const cookies = Object.fromEntries(document.cookie.split('; ').map(c => c.split('=')))
    return {
        fbp: cookies['_fbp'] ?? null,
        fbc: cookies['_fbc'] ?? null,
    }
}
