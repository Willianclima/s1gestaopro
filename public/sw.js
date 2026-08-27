// Service Worker de Produção - Gestão de Serviços & Manutenção
// Arquivo: public/sw.js

const CACHE_NAME = 'gestao-servicos-sw-v3';
const PHOTOS_CACHE_NAME = 'service-photos';
const DATA_CACHE_NAME = 'gestao-servicos-localdata-v1';

const MAX_PHOTO_CACHE_BYTES = 50 * 1024 * 1024; // Limite máximo de 50MB de armazenamento para evidências
const MAX_PHOTO_CACHE_ENTRIES = 150; // Limite padrão de quantidade de imagens

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

// Função utilitária de política de expiração por tamanho (50MB) e quantidade no CacheStorage 'service-photos'
async function prunePhotoCache(maxBytes = MAX_PHOTO_CACHE_BYTES, maxEntries = MAX_PHOTO_CACHE_ENTRIES) {
  try {
    const photoCache = await caches.open(PHOTOS_CACHE_NAME);
    const keys = await photoCache.keys();
    if (keys.length === 0) return;

    let totalSizeBytes = 0;
    const entries = [];

    // Calcula o tamanho ocupado por cada foto armazenada em 'service-photos'
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
            size = 100 * 1024; // Estimativa padrão de 100KB por imagem
          }
        }
        totalSizeBytes += size;
        entries.push({ request, size });
      }
    }

    // Se o uso de armazenamento exceder 50MB (ou o limite de itens), remove as fotos mais antigas em ordem FIFO
    if (totalSizeBytes > maxBytes || entries.length > maxEntries) {
      console.log(`[SW CacheStorage 'service-photos'] Limite excedido (${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB / 50MB). Limpando fotos antigas...`);
      for (const entry of entries) {
        if (totalSizeBytes <= maxBytes && entries.length <= maxEntries) break;
        await photoCache.delete(entry.request);
        totalSizeBytes -= entry.size;
        console.log(`[SW CacheStorage 'service-photos'] Foto de evidência antiga removida do cache: ${entry.request.url}`);
      }
    }
  } catch (err) {
    console.warn('[SW CacheStorage] Erro ao aplicar limite de 50MB em service-photos:', err);
  }
}

// Função para escanear o CacheStorage 'service-photos' e remover arquivos expirados ou sem referência ativa em OS registradas
async function clearExpiredPhotos(activePhotoUrls = null, maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
  try {
    const photoCache = await caches.open(PHOTOS_CACHE_NAME);
    const requests = await photoCache.keys();
    if (requests.length === 0) return;

    console.log(`[SW clearExpiredPhotos] Escaneando ${requests.length} fotos no CacheStorage '${PHOTOS_CACHE_NAME}'...`);
    const now = Date.now();
    let removedCount = 0;

    // Tenta obter a lista de fotos de OS ativas caso fornecida
    const activeUrlsSet = activePhotoUrls && Array.isArray(activePhotoUrls) 
      ? new Set(activePhotoUrls.map(u => typeof u === 'string' ? u.toLowerCase() : ''))
      : null;

    for (const request of requests) {
      const url = request.url;
      const urlLower = url.toLowerCase();
      let shouldDelete = false;

      // 1. Se possuir lista de fotos de OS ativas e a URL da foto não constar no conjunto ativo
      if (activeUrlsSet && activeUrlsSet.size > 0) {
        if (!activeUrlsSet.has(urlLower) && !Array.from(activeUrlsSet).some(activeUrl => activeUrl && (urlLower.includes(activeUrl) || activeUrl.includes(urlLower)))) {
          shouldDelete = true;
          console.log(`[SW clearExpiredPhotos] Foto órfã detectada (sem referência ativa em nenhuma OS): ${url}`);
        }
      }

      // 2. Se não foi deletada como órfã, verifica expiração por idade / data HTTP
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
              console.log(`[SW clearExpiredPhotos] Foto expirada por tempo limite de retenção (>14 dias): ${url}`);
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
      console.log(`[SW clearExpiredPhotos] Varredura concluída: ${removedCount} foto(s) de evidência órfã(s) ou expirada(s) removida(s) de '${PHOTOS_CACHE_NAME}'.`);
    } else {
      console.log(`[SW clearExpiredPhotos] Varredura concluída: Nenhuma foto órfã ou expirada encontrada.`);
    }
  } catch (err) {
    console.warn('[SW clearExpiredPhotos] Erro durante o escaneamento de fotos de evidência:', err);
  }
}

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando Service Worker com suporte a Stale-While-Revalidate para LocalStorage...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Pré-cacheando recursos essenciais do PWA no cache principal...');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      caches.open(PHOTOS_CACHE_NAME).then(() => {
        console.log('[Service Worker] Inicializando CacheStorage isolado para evidências fotográficas.');
      }),
      caches.open(DATA_CACHE_NAME).then(() => {
        console.log('[Service Worker] Inicializando CacheStorage isolado para dados do LocalStorage.');
      })
    ]).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos + preservação do cache de dados e fotos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando e assumindo controle...');
  const currentCaches = [CACHE_NAME, PHOTOS_CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!currentCaches.includes(cache)) {
            console.log('[Service Worker] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => clearExpiredPhotos())
    .then(() => self.clients.claim())
  );
});

// Helper para verificar se a requisição é para uma foto/imagem de evidência
function isEvidencePhotoRequest(request) {
  const url = request.url.toLowerCase();
  
  if (request.destination === 'image') return true;

  const imageExtensions = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff)(\?.*)?$/i;
  if (imageExtensions.test(url)) return true;

  const evidenceDirectories = [
    '/photos/',
    '/evidences/',
    '/evidence/',
    '/uploads/',
    '/images/',
    '/assets/images/',
    '/storage/'
  ];
  if (evidenceDirectories.some(dir => url.includes(dir))) return true;

  if (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('images.unsplash.com') ||
    url.includes('cloudinary.com') ||
    url.includes('data:image')
  ) {
    return true;
  }

  return false;
}

// Estratégia Stale-While-Revalidate dedicada para endpoints de dados / LocalStorage
async function handleDataSWR(request) {
  const dataCache = await caches.open(DATA_CACHE_NAME);
  const cachedResponse = await dataCache.match(request);

  // Busca na rede em segundo plano para revalidação
  const networkFetch = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        await dataCache.put(request, networkResponse.clone());

        // Notifica abas ativas sobre os dados mais recentes revalidados
        try {
          const freshData = await networkResponse.clone().json();
          const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientsList) {
            client.postMessage({
              type: 'LOCALSTORAGE_SWR_UPDATE',
              url: request.url,
              payload: freshData,
              timestamp: Date.now()
            });
          }
        } catch (e) {
          // não era JSON
        }
      }
      return networkResponse;
    })
    .catch((err) => {
      console.warn('[SW SWR Data] Offline ou falha na rede ao revalidar dados:', request.url);
      return cachedResponse;
    });

  // Se houver resposta em cache (stale), entrega IMEDIATAMENTE sem esperar a rede
  if (cachedResponse) {
    networkFetch.catch(() => {});
    return cachedResponse;
  }

  // Caso contrário, aguarda a resposta da rede
  return networkFetch;
}

// Interceptação de Requisições de Rede
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = event.request.url;

  // 1. Estratégia Stale-While-Revalidate para requisições de dados/API e dados de LocalStorage
  if (
    requestUrl.includes('/api/') ||
    requestUrl.includes('/local-data/') ||
    requestUrl.includes('/local-data-cache/') ||
    requestUrl.includes('/data-sync/')
  ) {
    event.respondWith(handleDataSWR(event.request));
    return;
  }

  // 2. Estratégia Stale-While-Revalidate para FOTOS E EVIDÊNCIAS FOTOGRÁFICAS
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
            .catch((err) => {
              console.warn('[SW Stale-While-Revalidate] Dispositivo offline ao revalidar foto de evidência:', requestUrl);
              return cachedResponse;
            });

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

  // Ignora requisições de outras origens
  if (!requestUrl.startsWith(self.location.origin)) {
    return;
  }

  // 3. Para navegação HTML (document), tenta a rede e faz fallback para index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 4. Para outros ativos estáticos (JS, CSS, fontes): Cache First com revalidação
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Offline - mantém versão cacheada */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});

// Comunicação com o App para LocalStorage, Pré-cache manual de Fotos e Varredura
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // A. Sincronização e Caching de Snapshots do LocalStorage com Estratégia Stale-While-Revalidate
  if (event.data.type === 'SYNC_LOCALSTORAGE' && event.data.storageData) {
    event.waitUntil(
      caches.open(DATA_CACHE_NAME).then(async (dataCache) => {
        const storageObj = event.data.storageData;
        const keys = Object.keys(storageObj);

        for (const key of keys) {
          const val = storageObj[key];
          if (val !== undefined && val !== null) {
            const cacheKey = `${self.location.origin}/local-data-cache/${key}`;
            const rawText = typeof val === 'string' ? val : JSON.stringify(val);
            const jsonBlob = new Blob([rawText], { type: 'application/json; charset=utf-8' });
            const responseToCache = new Response(jsonBlob, {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-LocalStorage-Key': key,
                'X-LocalStorage-Cached-At': new Date().toISOString(),
                'Cache-Control': 'public, max-age=31536000'
              }
            });
            await dataCache.put(cacheKey, responseToCache);
          }
        }
        console.log(`[SW LocalStorage SWR] Sincronizadas ${keys.length} chave(s) do LocalStorage no CacheStorage '${DATA_CACHE_NAME}'.`);
      })
    );
  }

  // B. Recuperação Stale de Snapshots do LocalStorage e disparo de Revalidação
  if (event.data.type === 'GET_STALE_LOCALSTORAGE') {
    const keysToFetch = Array.isArray(event.data.keys) ? event.data.keys : [];
    event.waitUntil(
      caches.open(DATA_CACHE_NAME).then(async (dataCache) => {
        const staleResults = {};
        for (const key of keysToFetch) {
          const cacheKey = `${self.location.origin}/local-data-cache/${key}`;
          const matched = await dataCache.match(cacheKey);
          if (matched) {
            try {
              staleResults[key] = await matched.text();
            } catch (e) {
              // ignore
            }
          }
        }

        // 1. Responde de imediato com os dados cacheados (stale) sem esperar pela rede
        if (event.source && 'postMessage' in event.source) {
          event.source.postMessage({
            type: 'STALE_LOCALSTORAGE_DATA',
            data: staleResults,
            timestamp: Date.now()
          });
        }

        // 2. Transmite dados revalidados aos clientes ativos
        try {
          const activeClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of activeClients) {
            client.postMessage({
              type: 'REVALIDATED_LOCALSTORAGE_DATA',
              data: staleResults,
              revalidatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.warn('[SW LocalStorage SWR] Erro ao revalidar dados em segundo plano:', err);
        }
      })
    );
  }

  // C. Pré-cache manual de fotos de evidências de OS
  if (event.data.type === 'CACHE_EVIDENCE_PHOTOS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(PHOTOS_CACHE_NAME).then(async (photoCache) => {
        const orderId = event.data.orderId || 'os_evidence';
        await Promise.all(
          event.data.urls.map(async (url, idx) => {
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
              console.warn('[SW] Não foi possível salvar foto no CacheStorage service-photos:', url, err);
            }
          })
        );
        await prunePhotoCache();
      })
    );
  }

  // D. Limpeza e remoção de fotos órfãs e expiradas
  if (event.data.type === 'CLEAR_EXPIRED_PHOTOS' || event.data.type === 'SYNC_ACTIVE_OS_PHOTOS') {
    const activePhotoUrls = Array.isArray(event.data.activePhotoUrls) ? event.data.activePhotoUrls : null;
    event.waitUntil(clearExpiredPhotos(activePhotoUrls));
  }
});

// Tratamento de Eventos Push de Notificações em Tempo Real
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Gestão de Serviços - Atualização',
    body: 'Uma nova ordem de serviço ou atualização foi registrada.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'os-update'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = Object.assign({}, notificationData, parsed);
    } catch (err) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});


// Tratamento de Eventos Push de Notificações em Tempo Real
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Gestão de Serviços - Atualização',
    body: 'Uma nova ordem de serviço ou atualização foi registrada.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'os-update'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = Object.assign({}, notificationData, parsed);
    } catch (err) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
