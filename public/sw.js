// Service Worker de Produção - Gestão de Serviços & Manutenção
// Arquivo: public/sw.js

const CACHE_NAME = 'gestao-servicos-sw-v3';
const PHOTOS_CACHE_NAME = 'service-photos';
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

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando Service Worker com CacheStorage dedicado para evidências...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Pré-cacheando recursos essenciais do PWA no cache principal...');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      caches.open(PHOTOS_CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Inicializando CacheStorage isolado para evidências fotográficas.');
      })
    ]).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando e assumindo controle...');
  const currentCaches = [CACHE_NAME, PHOTOS_CACHE_NAME];
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
    }).then(() => self.clients.claim())
  );
});

// Helper para verificar se a requisição é para uma foto/imagem de evidência
function isEvidencePhotoRequest(request) {
  const url = request.url.toLowerCase();
  
  // 1. Destino nativo da requisição de imagem no navegador
  if (request.destination === 'image') return true;

  // 2. Extensões de arquivos de imagens de evidência fotográfica
  const imageExtensions = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|tiff)(\?.*)?$/i;
  if (imageExtensions.test(url)) return true;

  // 3. Diretórios e caminhos de armazenamento de fotos e evidências técnicas
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

  // 4. Domínios de armazenamento e hospedagem de imagens de evidências
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

// Interceptação de Requisições de Rede
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  const requestUrl = event.request.url;

  // 1. Estratégia de Cache 'Stale-While-Revalidate' para FOTOS E EVIDÊNCIAS FOTOGRÁFICAS das Ordens de Serviço:
  // Retorna a foto do cache imediatamente (stale) garantindo carregamento offline instantâneo,
  // enquanto busca em segundo plano na rede a versão mais recente para atualizar o cache (revalidate).
  if (isEvidencePhotoRequest(event.request)) {
    event.respondWith(
      caches.open(PHOTOS_CACHE_NAME).then((photoCache) => {
        return photoCache.match(event.request).then((cachedResponse) => {
          // Dispara revalidação na rede em segundo plano para manter o cache atualizado
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

          // Se a foto já estiver salva no cache, entrega imediatamente ao usuário (Offline Instantâneo)
          if (cachedResponse) {
            return cachedResponse;
          }

          // Caso ainda não esteja em cache, aguarda a resposta da rede e armazena
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

  // Ignora requisições de outras origens não-estáticas que não sejam imagens
  if (!requestUrl.startsWith(self.location.origin)) {
    return;
  }

  // 2. Para navegação HTML (document), tenta a rede e faz fallback para o cache index.html
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

  // 3. Para outros ativos estáticos (JS, CSS, fontes): Cache First com revalidação
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

// Comunicação com o App (ex: Pré-cache manual de fotos de uma Ordem de Serviço)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_EVIDENCE_PHOTOS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(PHOTOS_CACHE_NAME).then((photoCache) => {
        return Promise.all(
          event.data.urls.map((url) => {
            if (!url || typeof url !== 'string' || url.startsWith('data:')) return Promise.resolve();
            return fetch(url, { mode: 'no-cors' }).then((res) => {
              if (res && (res.status === 200 || res.type === 'opaque')) {
                return photoCache.put(url, res);
              }
            }).catch((err) => console.warn('[SW] Não foi possível pré-cachear foto:', url, err));
          })
        );
      })
    );
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
