// Service Worker de Produção - Gestão de Serviços & Manutenção
// Arquivo: src/sw.ts

const _self = self as any;

const CACHE_NAME = 'gestao-servicos-sw-v3';
const PHOTOS_CACHE_NAME = 'service-photos';
const MAX_PHOTO_CACHE_BYTES = 50 * 1024 * 1024; // Limite máximo de 50MB
const MAX_PHOTO_CACHE_ENTRIES = 150; // Limite de 150 imagens

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Função utilitária de rotação/expiração no CacheStorage 'service-photos'
async function prunePhotoCache(maxBytes = MAX_PHOTO_CACHE_BYTES, maxEntries = MAX_PHOTO_CACHE_ENTRIES) {
  try {
    const photoCache = await caches.open(PHOTOS_CACHE_NAME);
    const keys = await photoCache.keys();
    if (keys.length === 0) return;

    let totalSizeBytes = 0;
    const entries: { request: Request; size: number }[] = [];

    for (const request of keys) {
      const response = await photoCache.match(request);
      if (response) {
        let size = 0;
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          size = parseInt(contentLength, 10) || 0;
        } else {
          try {
            const blob = await response.clone().blob();
            size = blob.size || 0;
          } catch (e) {
            size = 100 * 1024;
          }
        }
        totalSizeBytes += size;
        entries.push({ request, size });
      }
    }

    if (totalSizeBytes > maxBytes || entries.length > maxEntries) {
      console.log(`[SW service-photos] Limite excedido (${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB / 50MB). Removendo fotos antigas...`);
      for (const entry of entries) {
        if (totalSizeBytes <= maxBytes && entries.length <= maxEntries) break;
        await photoCache.delete(entry.request);
        totalSizeBytes -= entry.size;
      }
    }
  } catch (err) {
    console.warn('[SW service-photos] Erro ao aplicar política de expiração:', err);
  }
}

// Limpeza de fotos sem referência ativa em OS
async function clearExpiredPhotos(activePhotoUrls: string[] | null = null, maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
  try {
    const photoCache = await caches.open(PHOTOS_CACHE_NAME);
    const requests = await photoCache.keys();
    if (requests.length === 0) return;

    const now = Date.now();
    let removedCount = 0;

    const activeUrlsSet = activePhotoUrls && Array.isArray(activePhotoUrls) 
      ? new Set(activePhotoUrls.map(u => typeof u === 'string' ? u.toLowerCase() : ''))
      : null;

    for (const request of requests) {
      const url = request.url;
      const urlLower = url.toLowerCase();
      let shouldDelete = false;

      if (activeUrlsSet && activeUrlsSet.size > 0) {
        if (!activeUrlsSet.has(urlLower) && !Array.from(activeUrlsSet).some(activeUrl => activeUrl && (urlLower.includes(activeUrl) || activeUrl.includes(urlLower)))) {
          shouldDelete = true;
        }
      }

      if (!shouldDelete) {
        const response = await photoCache.match(request);
        if (response) {
          const expiresHeader = response.headers.get('expires');
          const dateHeader = response.headers.get('date');

          if (expiresHeader) {
            const expiresTime = new Date(expiresHeader).getTime();
            if (!isNaN(expiresTime) && expiresTime < now) {
              shouldDelete = true;
            }
          }

          if (!shouldDelete && dateHeader) {
            const cachedTime = new Date(dateHeader).getTime();
            if (!isNaN(cachedTime) && (now - cachedTime) > maxAgeMs) {
              shouldDelete = true;
            }
          }
        }
      }

      if (shouldDelete) {
        await photoCache.delete(request);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[SW clearExpiredPhotos] ${removedCount} foto(s) de evidência removida(s) de '${PHOTOS_CACHE_NAME}'.`);
    }
  } catch (err) {
    console.warn('[SW clearExpiredPhotos] Erro durante a limpeza de fotos:', err);
  }
}

// Instalação
_self.addEventListener('install', (event: any) => {
  console.log('[Service Worker] Instalando com suporte a fotos comprimidas via Canvas...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
      caches.open(PHOTOS_CACHE_NAME)
    ]).then(() => _self.skipWaiting())
  );
});

// Ativação
_self.addEventListener('activate', (event: any) => {
  console.log('[Service Worker] Ativando e assumindo controle...');
  const currentCaches = [CACHE_NAME, PHOTOS_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!currentCaches.includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => clearExpiredPhotos())
    .then(() => _self.clients.claim())
  );
});

function isEvidencePhotoRequest(request: Request): boolean {
  const url = request.url.toLowerCase();
  if (request.destination === 'image') return true;
  if (/\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff)(\?.*)?$/i.test(url)) return true;
  const evidenceDirectories = ['/photos/', '/evidences/', '/evidence/', '/uploads/', '/images/', '/assets/images/', '/storage/'];
  if (evidenceDirectories.some(dir => url.includes(dir))) return true;
  if (url.includes('firebasestorage.googleapis.com') || url.includes('images.unsplash.com') || url.includes('cloudinary.com') || url.includes('data:image')) {
    return true;
  }
  return false;
}

// Fetch (Stale-While-Revalidate)
_self.addEventListener('fetch', (event: any) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  if (isEvidencePhotoRequest(event.request)) {
    event.respondWith(
      caches.open(PHOTOS_CACHE_NAME).then((photoCache) => {
        return photoCache.match(event.request).then((cachedResponse) => {
          const networkFetch = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                photoCache.put(event.request, networkResponse.clone()).then(() => prunePhotoCache());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          if (cachedResponse) {
            return cachedResponse;
          }

          return networkFetch.then((networkResponse) => {
            if (networkResponse) return networkResponse;
            return new Response('Foto de evidência indisponível offline', {
              status: 503,
              statusText: 'Offline Photo Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
            });
          });
        });
      })
    );
    return;
  }

  if (!event.request.url.startsWith(_self.location.origin)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Message
_self.addEventListener('message', (event: any) => {
  if (!event.data) return;

  if (event.data.type === 'CACHE_EVIDENCE_PHOTOS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(PHOTOS_CACHE_NAME).then(async (photoCache) => {
        const orderId = event.data.orderId || 'os_evidence';
        await Promise.all(
          event.data.urls.map(async (url: string, idx: number) => {
            if (!url || typeof url !== 'string') return;
            try {
              if (url.startsWith('data:')) {
                const res = await fetch(url);
                const blob = await res.blob();
                const key = `/photos/compressed_${orderId}_${idx}.jpg`;
                const responseToCache = new Response(blob, {
                  headers: {
                    'Content-Type': blob.type || 'image/jpeg',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'Content-Length': blob.size.toString(),
                    'X-Canvas-Compressed': 'true'
                  }
                });
                await photoCache.put(key, responseToCache);
                await photoCache.put(url, responseToCache.clone());
              } else {
                const res = await fetch(url, { mode: 'no-cors' });
                if (res && (res.status === 200 || res.type === 'opaque')) {
                  await photoCache.put(url, res);
                }
              }
            } catch (err) {
              console.warn('[SW] Falha ao armazenar foto em service-photos:', url, err);
            }
          })
        );
        await prunePhotoCache();
      })
    );
  }

  if (event.data.type === 'CLEAR_EXPIRED_PHOTOS' || event.data.type === 'SYNC_ACTIVE_OS_PHOTOS') {
    const activePhotoUrls = Array.isArray(event.data.activePhotoUrls) ? event.data.activePhotoUrls : null;
    event.waitUntil(clearExpiredPhotos(activePhotoUrls));
  }
});
