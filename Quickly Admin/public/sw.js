const CACHE_NAME = 'zipit-image-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_IMAGES') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          urls.map((url) => {
            if (!url) return Promise.resolve();
            return cache.match(url).then((response) => {
              if (!response) {
                return fetch(url, { mode: 'cors', credentials: 'omit' }).then((networkResponse) => {
                  if (networkResponse.ok || networkResponse.type === 'opaque') {
                    return cache.put(url, networkResponse);
                  }
                }).catch(() => {
                  console.log('Failed to precache:', url);
                });
              }
            });
          })
        );
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Cache supabase storage images and general image requests
  const isImageRequest = event.request.destination === 'image' || url.href.includes('supabase.co/storage/v1/object/public/');
  
  if (event.request.method === 'GET' && isImageRequest) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok || networkResponse.type === 'opaque') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fallback or ignore if network fails
        });
      })
    );
  }
});
