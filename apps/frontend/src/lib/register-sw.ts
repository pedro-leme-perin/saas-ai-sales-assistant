/**
 * Service Worker registration utility
 * Handles registration, updates, and offline messaging
 */

export interface ServiceWorkerUpdateHandler {
  onUpdate?: () => void;
  onOffline?: (error: Error) => void;
}

let registration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(
  options: ServiceWorkerUpdateHandler = {}
): void {
  // Only register in browser environment with SW support
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Only register in production to avoid dev mode issues
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[SW] Skipping registration in development mode');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
      })
      .then((reg) => {
        registration = reg;
        console.log('[SW] Registered successfully:', reg.scope);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is ready, notify client
              console.log('[SW] Update available');
              options.onUpdate?.();

              // Automatically skip waiting (immediate activation)
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Check for updates every hour
        setInterval(() => {
          reg.update().catch((err) => {
            console.warn('[SW] Update check failed:', err);
          });
        }, 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
        options.onOffline?.(err);
      });
  });
}

/**
 * Unregister service worker (for cleanup or testing)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!registration) {
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      } catch (err) {
        console.warn('[SW] Unregister failed:', err);
      }
    }
    return;
  }

  try {
    await registration.unregister();
    registration = null;
    console.log('[SW] Unregistered successfully');
  } catch (err) {
    console.warn('[SW] Unregister failed:', err);
  }
}

/**
 * Get current registration
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

/**
 * Check if offline (no active connection)
 */
export function isOffline(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !navigator.onLine;
}

/**
 * Listen for online/offline status changes
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
