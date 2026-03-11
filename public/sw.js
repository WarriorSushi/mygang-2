// MyGang minimal service worker — install/activate only.
// No heavy caching. Push handling will be added in Phase 07B.

const CACHE_NAME = 'mygang-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    if (event.request.mode !== 'navigate') return
    event.respondWith(
        fetch(event.request).catch(() =>
            caches.match(OFFLINE_URL).then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    )
})

// Phase 07B: Push notification handling
self.addEventListener('push', (event) => {
    let title = 'MyGang'
    let options = {
        body: 'Your gang has something new',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: { url: '/chat' },
    }

    if (event.data) {
        try {
            const payload = event.data.json()
            title = payload.title || title
            options.body = payload.body || options.body
            if (payload.url) options.data.url = payload.url
        } catch {
            // If not JSON, use text as body
            const text = event.data.text()
            if (text) options.body = text
        }
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || '/chat'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Focus an existing tab if one is open
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl)
                    return client.focus()
                }
            }
            // Otherwise open a new window
            return self.clients.openWindow(targetUrl)
        })
    )
})
