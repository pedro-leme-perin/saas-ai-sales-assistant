/**
 * TheIAdvisor Service Worker v2
 * Strategies: cache-first (static), network-first (API), stale-while-revalidate (HTML)
 * Features: background sync, push notifications, offline fallback, cache limits
 */

const CACHE_NAME = 'theiadvisor-v2';
const API_CACHE = 'theiadvisor-api-v2';
const STATIC_CACHE = 'theiadvisor-static-v2';

const MAX_API_CACHE_ENTRIES = 50;

const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/offline.html',
];

const STATIC_EXTENSIONS = [
  '.js', '.css', '.woff', '.woff2', '.ttf', '.otf',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
];

// ---------------------------------------------------------------------------
// IndexedDB helpers for background sync queue
// ---------------------------------------------------------------------------

const DB_NAME = 'theiadvisor-sync';
const STORE_NAME = 'failed-mutations';
const DB_VERSION = 1;

function openSyncDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

function addToSyncQueue(entry) {
  return openSyncDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(entry);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  });
}

function getAllFromSyncQueue() {
  return openSyncDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  });
}

function removeFromSyncQueue(id) {
  return openSyncDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  });
}

// ---------------------------------------------------------------------------
// Cache utilities
// ---------------------------------------------------------------------------

function isStaticAsset(url) {
  var pathname = url.pathname.toLowerCase();
  for (var i = 0; i < STATIC_EXTENSIONS.length; i++) {
    if (pathname.endsWith(STATIC_EXTENSIONS[i])) return true;
  }
  // Next.js static chunks
  if (pathname.startsWith('/_next/static/')) return true;
  return false;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') &&
      request.headers.get('accept').indexOf('text/html') !== -1);
}

function isMutationRequest(request) {
  return request.method === 'POST' ||
    request.method === 'PUT' ||
    request.method === 'DELETE' ||
    request.method === 'PATCH';
}

/**
 * Trim a cache to a max number of entries (oldest first).
 */
function trimCache(cacheName, maxEntries) {
  return caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (keys) {
      if (keys.length <= maxEntries) return;
      // Delete oldest entries (first in list)
      var deleteCount = keys.length - maxEntries;
      var deletions = [];
      for (var i = 0; i < deleteCount; i++) {
        deletions.push(cache.delete(keys[i]));
      }
      return Promise.all(deletions);
    });
  });
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
        console.warn('[SW] Failed to cache some assets on install:', err);
      });
    })
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', function (event) {
  var validCaches = [CACHE_NAME, API_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return validCaches.indexOf(k) === -1; })
          .map(function (k) {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    })
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — routing by request type
// ---------------------------------------------------------------------------

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip cross-origin requests (except same-origin check)
  if (url.origin !== self.location.origin) return;

  // ---- API mutations: background sync on failure ----
  if (url.pathname.startsWith('/api/') && isMutationRequest(request)) {
    event.respondWith(
      fetch(request.clone()).catch(function () {
        // Store failed mutation for retry
        return request.clone().text().then(function (body) {
          return addToSyncQueue({
            url: request.url,
            method: request.method,
            headers: Object.fromEntries
              ? Object.fromEntries(request.headers.entries())
              : serializeHeaders(request.headers),
            body: body,
            timestamp: Date.now(),
          }).then(function () {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'queued',
                message: 'Requisicao salva para envio quando a conexao retornar.',
              }),
              {
                status: 202,
                statusText: 'Accepted',
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        }).catch(function () {
          return new Response(
            JSON.stringify({ success: false, error: 'offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        });
      })
    );
    return;
  }

  // Skip non-GET from here on
  if (request.method !== 'GET') return;

  // ---- API GET: network-first, cache fallback, limit 50 entries ----
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(API_CACHE).then(function (cache) {
            cache.put(request, clone);
            trimCache(API_CACHE, MAX_API_CACHE_ENTRIES);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || new Response(
            JSON.stringify({
              success: false,
              error: 'offline',
              message: 'Voce esta offline. Alguns dados podem estar desatualizados.',
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' },
            }
          );
        });
      })
    );
    return;
  }

  // ---- Static assets (JS, CSS, images, fonts): cache-first ----
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(STATIC_CACHE).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // ---- HTML pages: stale-while-revalidate, offline fallback ----
  if (isNavigationRequest(request)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        var fetchPromise = fetch(request).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        }).catch(function () {
          // Navigation failed and no cache — serve offline page
          if (cached) return cached;
          return caches.match('/offline.html');
        });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ---- Everything else: stale-while-revalidate ----
  event.respondWith(
    caches.match(request).then(function (cached) {
      var fetchPromise = fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type !== 'error') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(function () {
        return cached || new Response('Offline', { status: 503 });
      });
      return cached || fetchPromise;
    })
  );
});

// ---------------------------------------------------------------------------
// Background sync — replay queued mutations when online
// ---------------------------------------------------------------------------

self.addEventListener('sync', function (event) {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(replayMutations());
  }
});

function replayMutations() {
  return getAllFromSyncQueue().then(function (entries) {
    return Promise.all(entries.map(function (entry) {
      return fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined,
      }).then(function (response) {
        if (response.ok || response.status < 500) {
          // Success or client error (don't retry 4xx) — remove from queue
          return removeFromSyncQueue(entry.id);
        }
        // 5xx — leave in queue for next sync
      }).catch(function () {
        // Still offline — leave in queue
      });
    }));
  });
}

// Also try replaying when SW gets a generic message
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'REPLAY_MUTATIONS') {
    event.waitUntil(replayMutations());
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', function (event) {
  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TheIAdvisor', body: event.data.text() };
    }
  }

  var title = data.title || 'TheIAdvisor';
  var options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    tag: data.tag || 'theiadvisor-notification',
    renotify: !!data.renotify,
    data: {
      url: data.url || '/dashboard',
      timestamp: Date.now(),
    },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Notification click — focus or open window
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  // Handle action buttons
  if (event.action) {
    // Actions can carry their own URLs
    targetUrl = event.action || targetUrl;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Try to focus an existing window with the same origin
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing window — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ---------------------------------------------------------------------------
// Notification close (analytics hook)
// ---------------------------------------------------------------------------

self.addEventListener('notificationclose', function () {
  // Placeholder for future analytics
});

// ---------------------------------------------------------------------------
// Header serialization fallback for older environments
// ---------------------------------------------------------------------------

function serializeHeaders(headers) {
  var result = {};
  if (headers.forEach) {
    headers.forEach(function (value, key) {
      result[key] = value;
    });
  }
  return result;
}
