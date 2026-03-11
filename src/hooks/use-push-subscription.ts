'use client'

import { useCallback, useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from '@/lib/push/vapid'

export type PushState =
    | 'unsupported'     // browser lacks SW / PushManager / Notification
    | 'loading'         // checking current state
    | 'default'         // permission not yet requested
    | 'subscribed'      // granted + active subscription on this device
    | 'unsubscribed'    // granted but no active sub (or sub removed)
    | 'denied'          // user blocked notifications

function getBrowserSupport() {
    if (typeof window === 'undefined') return false
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function usePushSubscription() {
    const [state, setState] = useState<PushState>('loading')
    const [busy, setBusy] = useState(false)

    // Check current state on mount
    useEffect(() => {
        if (!getBrowserSupport()) {
            setState('unsupported')
            return
        }

        async function check() {
            const permission = Notification.permission
            if (permission === 'denied') {
                setState('denied')
                return
            }

            try {
                const reg = await navigator.serviceWorker.ready
                const sub = await reg.pushManager.getSubscription()
                if (sub) {
                    setState('subscribed')
                } else {
                    setState(permission === 'granted' ? 'unsubscribed' : 'default')
                }
            } catch {
                setState('default')
            }
        }

        check()
    }, [])

    const subscribe = useCallback(async () => {
        if (!getBrowserSupport()) return
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
            console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
            return
        }

        setBusy(true)
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'denied') {
                setState('denied')
                return
            }
            if (permission !== 'granted') {
                setState('default')
                return
            }

            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
            })

            const json = sub.toJSON()
            const res = await fetch('/api/push/subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: sub.endpoint,
                    p256dh: json.keys?.p256dh ?? '',
                    auth: json.keys?.auth ?? '',
                }),
            })

            if (res.ok) {
                setState('subscribed')
            } else {
                console.error('[push] Server rejected subscription')
                await sub.unsubscribe()
                setState('unsubscribed')
            }
        } catch (err) {
            console.error('[push] Subscribe failed:', err)
        } finally {
            setBusy(false)
        }
    }, [])

    const unsubscribe = useCallback(async () => {
        if (!getBrowserSupport()) return

        setBusy(true)
        try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()
            if (!sub) {
                setState('unsubscribed')
                return
            }

            const res = await fetch('/api/push/subscription', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            })

            if (!res.ok) {
                console.error('[push] Server failed to delete subscription, keeping local state')
                return
            }

            await sub.unsubscribe()
            setState('unsubscribed')
        } catch (err) {
            console.error('[push] Unsubscribe failed:', err)
        } finally {
            setBusy(false)
        }
    }, [])

    return { state, busy, subscribe, unsubscribe }
}
