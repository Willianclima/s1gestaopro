// Service Worker de Produção - Araçatuba Serviços de Manutenção e Assistência
// Arquivo: src/sw.ts

const _self = self as any;

const CACHE_NAME = 'aracatuba-servicos-sw-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// Instalação do Service Worker
_self.addEventListener('install', (event: any) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-cacheando arquivos básicos...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => _self.skipWaiting())
  );
});

// Ativação do Service Worker e limpeza de caches antigos
_self.addEventListener('activate', (event: any) => {
  console.log('[Service Worker] Ativando e assumindo controle...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => _self.clients.claim())
  );
});

// Tratamento de Requisições de Rede (Interceptação/Cache-First com Network Fallback)
_self.addEventListener('fetch', (event: any) => {
  // Ignora chamadas de API, requisições de outras origens ou métodos não GET
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('/api/') || 
    !event.request.url.startsWith(_self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
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
        // Fallback offline se necessário
        return caches.match('/');
      }) as Promise<Response>;
    })
  );
});

// Tratamento de Eventos Push de Notificações em Tempo Real
_self.addEventListener('push', (event: any) => {
  console.log('[Service Worker] Evento de Push recebido!');
  
  let notificationData = {
    title: 'Araçatuba Serviços - Nova Atualização',
    body: 'Uma nova atualização ou ordem de serviço foi registrada no sistema.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default-push-tag'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
    } catch (err) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options: NotificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: {
      url: _self.location.origin
    }
  };

  event.waitUntil(
    _self.registration.showNotification(notificationData.title, options)
  );
});

// Ação de clique na notificação (Foca ou abre a aba correspondente)
_self.addEventListener('notificationclick', (event: any) => {
  console.log('[Service Worker] Notificação clicada!');
  event.notification.close();

  const targetUrl = event.notification.data?.url || _self.location.origin;

  event.waitUntil(
    _self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      // Tenta focar em uma janela/aba que já esteja aberta com a URL do sistema
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não houver janela aberta, abre uma nova
      if (_self.clients.openWindow) {
        return _self.clients.openWindow(targetUrl);
      }
    })
  );
});

