/**
 * Viaje360 Service Worker
 * 
 * Caching strategy:
 * - Shell (app routes): Cache-first
 * - Static assets: Cache-first, long TTL
 * - Map tiles (OpenStreetMap): Cache-first, up to 500 tiles
 * - API calls: Network-first with cache fallback
 * - Push notifications: handled here
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `viaje360-shell-${CACHE_VERSION}`
const TILE_CACHE = `viaje360-tiles-${CACHE_VERSION}`
const API_CACHE = `viaje360-api-${CACHE_VERSION}`

const MAX_TILE_ENTRIES = 500
const MAX_API_ENTRIES = 50

// App shell — routes to precache
const SHELL_URLS = [
  '/',
  '/trips',
  '/pricing',
  '/login',
]

// ─── Install: precache shell ───────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      try {
        await cache.addAll(SHELL_URLS)
      } catch (err) {
        console.warn('[SW] Shell precache failed (some routes may not exist yet):', err)
      }
    })
  )
  self.skipWaiting()
})

// ─── Activate: clean old caches ───────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const validCaches = [SHELL_CACHE, TILE_CACHE, API_CACHE]
      await Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => caches.delete(key))
      )
      await self.clients.claim()
    })
  )
})

// ─── Fetch: routing logic ──────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and browser extension requests
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Map tiles (OpenStreetMap) — cache-first, evict oldest beyond limit
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tiles.stadiamaps.com') ||
    url.hostname.includes('tile.thunderforest.com')
  ) {
    event.respondWith(cacheTiles(request))
    return
  }

  // API routes — network-first with offline fallback
  if (url.pathname.startsWith('/api/')) {
    // Don't cache auth-sensitive or mutation endpoints
    const noCacheApis = ['/api/stripe', '/api/webhook', '/api/notifications/send']
    if (noCacheApis.some(path => url.pathname.startsWith(path))) return

    event.respondWith(networkFirstWithCache(request, API_CACHE, MAX_API_ENTRIES))
    return
  }

  // Static assets (_next/static) — cache-first, immutable
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // App pages — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
})

// ─── Cache strategies ──────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function cacheTiles(request) {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      // Evict oldest entries if over limit
      const keys = await cache.keys()
      if (keys.length >= MAX_TILE_ENTRIES) {
        await cache.delete(keys[0])
      }
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Map tile unavailable offline', { status: 503 })
  }
}

async function networkFirstWithCache(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)
    if (response.ok) {
      const keys = await cache.keys()
      if (keys.length >= maxEntries) {
        await cache.delete(keys[0])
      }
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => cached)

  return cached || fetchPromise
}

// ─── Push notifications ────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Viaje360', body: event.data.text() }
  }

  const { title = 'Viaje360', body = '', icon = '/icon-192x192.png', badge = '/icon-192x192.png', url = '/', tag, data: extraData } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || 'viaje360-notification',
      data: { url, ...extraData },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(url)
    })
  )
})
