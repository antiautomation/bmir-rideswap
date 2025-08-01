const CACHE_NAME = 'bmir-rideshare-v2';
const RUNTIME_CACHE = 'bmir-rideshare-runtime';
const urlsToCache = [
  '/',
  '/index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './top200_us_cities.csv',
  // Updated Firebase version to match app.js
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Enhanced fetch event with offline-first strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests with network-first, cache fallback
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request);
        })
    );
    return;
  }
  
  // Handle static assets with cache-first strategy
  if (urlsToCache.includes(request.url) || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Fallback for documents
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }
  
  // Default fetch for other requests
  event.respondWith(
    fetch(request).catch(() => {
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Enhanced background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  } else if (event.tag === 'rideshare-post') {
    event.waitUntil(syncRideshareData());
  }
});

function doBackgroundSync() {
  console.log('Background sync triggered');
  return syncPendingData();
}

function syncRideshareData() {
  // Sync pending rideshare posts when connection is restored
  return new Promise((resolve) => {
    // Implementation for syncing offline data
    console.log('Syncing rideshare data...');
    resolve();
  });
}

function syncPendingData() {
  // Generic sync for any pending data
  return new Promise((resolve) => {
    console.log('Syncing pending data...');
    resolve();
  });
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data.data
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
}); 