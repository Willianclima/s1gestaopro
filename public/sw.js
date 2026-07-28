// Service Worker de Produção - Gestão de Serviços & Manutenção
// Arquivo: public/sw.js

const CACHE_NAME = 'gestao-servicos-sw-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-cacheando recursos essenciais...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando e assumindo controle...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de Requisições de Rede (Cache-First para estáticos, Network-First para navegação com fallback)
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('/api/') || 
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  // Para navegação HTML (document), tenta a rede e faz fallback para o cache
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

  // Para outros ativos estáticos (JS, CSS, imagens, fontes): Cache First com revalidação em segundo plano
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
