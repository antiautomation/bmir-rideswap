const CACHE_NAME = 'ridefinder-v2';
const RUNTIME_CACHE = 'ridefinder-runtime';
const urlsToCache = [
  '/',
  '/index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  // './top200_us_cities.csv',  // Not needed - cities are hardcoded in index.html
  // Updated Firebase version to match app.js
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js'
];

// Silent logging for offline scenarios
const logOffline = (message) => {
  // Only log in development
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log(`[SW] ${message}`);
  }
};

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        logOffline('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch(error => {
        logOffline('Cache installation failed: ' + error.message);
      })
  );
});

// Enhanced fetch event with offline-first strategy and better error handling
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests with cache-first strategy for better offline experience
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase')) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          // Try network first, fall back to cache
          return fetch(request)
            .then(response => {
              // Cache successful API responses for offline use
              if (response.ok && request.method === 'GET') {
                const responseClone = response.clone();
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, responseClone);
                }).catch(error => {
                  logOffline('Failed to cache API response: ' + error.message);
                });
              }
              return response;
            })
            .catch(() => {
              // Return cached version if network fails
              if (cachedResponse) {
                logOffline('Serving cached API response');
                return cachedResponse;
              }
              // Return a simple offline response for failed API calls
              return new Response(JSON.stringify({ 
                offline: true, 
                timestamp: Date.now(),
                message: 'Data unavailable offline'
              }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
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
              }).catch(error => {
                logOffline('Failed to cache static asset: ' + error.message);
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
          return new Response('Offline content not available', { status: 503 });
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
      return new Response('Offline content not available', { status: 503 });
    })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            logOffline('Deleting old cache: ' + cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).catch(error => {
      logOffline('Cache cleanup failed: ' + error.message);
    })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    logOffline('Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
async function doBackgroundSync() {
  try {
    logOffline('Syncing rideshare data...');
    await syncRideshareData();
    logOffline('Syncing pending data...');
    await syncPendingData();
  } catch (error) {
    logOffline('Background sync failed: ' + error.message);
  }
}

// Sync rideshare data
async function syncRideshareData() {
  // Implementation for syncing rideshare data
  // This would typically involve syncing with Firebase
}

// Sync pending data
async function syncPendingData() {
  // Implementation for syncing pending submissions
  // This would typically involve uploading locally stored data
}

// Handle push notifications for messaging
self.addEventListener('push', event => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || data.message || 'New message received',
        icon: '/logo.png',
        badge: '/logo.png',
        data: data.data || {},
        requireInteraction: false,
        silent: false,
        tag: data.data?.conversationId || 'message',
        actions: [
          {
            action: 'open',
            title: 'Open Conversation'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'New Message', options)
      );
    } catch (error) {
      logOffline('Failed to handle push notification: ' + error.message);
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if there's already a window/tab open with the app
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          // Focus the existing window
          client.focus();
          
          // If it's a message notification, try to open the conversation
          if (data?.conversationId) {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId: data.conversationId
            });
          }
          return;
        }
      }
      
      // If no existing window, open a new one
      return clients.openWindow('/').then(client => {
        // Wait a bit for the page to load, then send the message
        setTimeout(() => {
          if (data?.conversationId) {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId: data.conversationId
            });
          }
        }, 1000);
      });
    })
  );
});

// Handle background sync for messaging
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    logOffline('Background sync triggered');
    event.waitUntil(doBackgroundSync());
  } else if (event.tag === 'message-sync') {
    logOffline('Message sync triggered');
    event.waitUntil(syncPendingMessages());
  }
});

// Sync pending messages
async function syncPendingMessages() {
  try {
    logOffline('Syncing pending messages...');
    // This would sync any pending messages that were queued offline
    // Implementation depends on how offline message queuing is handled
  } catch (error) {
    logOffline('Message sync failed: ' + error.message);
  }
} 