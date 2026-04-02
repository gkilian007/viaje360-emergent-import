/**
 * Viaje360 Service Worker v2
 *
 * Caching strategy:
 * - Shell (app routes): Cache-first, precached on install
 * - Static assets (_next/static): Cache-first, immutable
 * - Map tiles (OSM/Stadia): Cache-first, max 500 tiles
 * - API /api/trips + /api/access: Stale-while-revalidate, 5-min TTL
 * - Unsplash images: Cache-first, 7-day TTL
 * - Other API routes: Network-first with cache fallback
 * - Navigation: Cache-first with offline fallback page
 * - Push notifications: handled here
 */

const CACHE_VERSION = 'v2'
const SHELL_CACHE = `viaje360-shell-${CACHE_VERSION}`
const TILE_CACHE = `viaje360-tiles-${CACHE_VERSION}`
const API_CACHE = `viaje360-api-${CACHE_VERSION}`
const IMAGE_CACHE = `viaje360-images-${CACHE_VERSION}`

const MAX_TILE_ENTRIES = 500
const MAX_API_ENTRIES = 50
const MAX_IMAGE_ENTRIES = 200

// Stale-while-revalidate TTL for trip/access API responses (ms)
const SWR_API_TTL_MS = 5 * 60 * 1000

// Cache-first TTL for Unsplash images (ms)
const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// App shell — routes to precache
const SHELL_URLS = [
  '/',
  '/plan',
  '/trips',
  '/pricing',
  '/login',
  '/offline',
]

// ─── Install: precache shell ────────────────────────────────────────────────

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

// ─── Activate: clean old caches ─────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const validCaches = [SHELL_CACHE, TILE_CACHE, API_CACHE, IMAGE_CACHE]
      await Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => caches.delete(key))
      )
      await self.clients.claim()
    })
  )
})

// ─── Fetch: routing logic ────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and browser extension requests
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Map tiles — cache-first, evict oldest beyond limit
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tiles.stadiamaps.com') ||
    url.hostname.includes('tile.thunderforest.com')
  ) {
    event.respondWith(cacheTiles(request))
    return
  }

  // Unsplash images — cache-first with 7-day TTL
  if (url.hostname.includes('images.unsplash.com') || url.hostname.includes('unsplash.com')) {
    event.respondWith(cacheFirstWithTTL(request, IMAGE_CACHE, IMAGE_TTL_MS, MAX_IMAGE_ENTRIES))
    return
  }

  // API routes
  if (url.pathname.startsWith('/api/')) {
    // Never cache auth-sensitive or mutation endpoints
    const noCacheApis = ['/api/stripe', '/api/webhook', '/api/notifications/send']
    if (noCacheApis.some(path => url.pathname.startsWith(path))) return

    // Stale-while-revalidate for frequently polled lightweight endpoints
    const swrApis = ['/api/trips', '/api/access']
    if (swrApis.some(path => url.pathname.startsWith(path))) {
      event.respondWith(staleWhileRevalidateWithTTL(request, API_CACHE, SWR_API_TTL_MS, MAX_API_ENTRIES))
      return
    }

    // Network-first with cache fallback for other API routes
    event.respondWith(networkFirstWithCache(request, API_CACHE, MAX_API_ENTRIES))
    return
  }

  // Static assets (_next/static) — cache-first, immutable
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // Navigation requests — stale-while-revalidate with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigateWithOfflineFallback(request))
    return
  }

  // Same-origin pages — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
})

// ─── Cache strategies ────────────────────────────────────────────────────────

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

async function cacheFirstWithTTL(request, cacheName, ttlMs, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    const cachedDate = cached.headers.get('sw-cached-at')
    if (cachedDate && Date.now() - Number(cachedDate) < ttlMs) {
      return cached
    }
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const keys = await cache.keys()
      if (keys.length >= maxEntries) {
        await cache.delete(keys[0])
      }
      // Clone response and add timestamp header
      const headers = new Headers(response.headers)
      headers.set('sw-cached-at', String(Date.now()))
      const timestamped = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
      cache.put(request, timestamped)
    }
    return response
  } catch {
    if (cached) return cached
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

async function staleWhileRevalidateWithTTL(request, cacheName, ttlMs, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Check if cached response is still fresh
  let isFresh = false
  if (cached) {
    const cachedDate = cached.headers.get('sw-cached-at')
    isFresh = cachedDate && Date.now() - Number(cachedDate) < ttlMs
  }

  // Kick off background revalidation if stale or no cache
  if (!isFresh) {
    const fetchPromise = fetch(request).then(async (response) => {
      if (response.ok) {
        const keys = await cache.keys()
        if (keys.length >= maxEntries) {
          await cache.delete(keys[0])
        }
        const headers = new Headers(response.headers)
        headers.set('sw-cached-at', String(Date.now()))
        const timestamped = new Response(await response.clone().blob(), {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
        cache.put(request, timestamped)
      }
      return response
    }).catch(() => null)

    // Return cached immediately if available, otherwise wait for network
    if (cached) return cached
    const networkResponse = await fetchPromise
    if (networkResponse) return networkResponse
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return cached
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

async function navigateWithOfflineFallback(request) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Try cached version of the requested page
    const cached = await cache.match(request)
    if (cached) return cached

    // Fall back to offline page
    const offlinePage = await cache.match('/offline')
    if (offlinePage) return offlinePage

    return new Response(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Sin conexión</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{background:#131315;color:#e4e2e4;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:1.5rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#9ca3af}</style>
      </head><body><div><h1>Sin conexión</h1><p>Tus datos se sincronizarán cuando vuelvas a tener conexión.</p></div></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    )
  }
}

// ─── Push notifications ──────────────────────────────────────────────────────

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
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
