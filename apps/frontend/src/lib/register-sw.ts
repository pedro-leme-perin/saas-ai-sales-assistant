/**
 * Service Worker registration utility
 * Handles registration, updates, and offline messaging
 */

import { logger } from './logger';

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
    logger.sw.debug('Skipping registration in development mode');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
      })
      .then((reg) => {
        registration = reg;
        logger.sw.info('Registered successfully', { scope: reg.scope });

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is ready, notify client
              logger.sw.info('Update available');
              options.onUpdate?.();

              // Automatically skip waiting (immediate activation)
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Check for updates every hour
        setInterval(() => {
          reg.update().catch((err) => {
            logger.sw.warn('Update check failed', { error: err });
          });
        }, 60 * 60 * 1000);
      })
      .catch((err) => {
        logger.sw.warn('Registration failed', { error: err });
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
        logger.sw.warn('Unregister failed', { error: err });
      }
    }
    return;
  }

  try {
    await registration.unregister();
    registration = null;
    logger.sw.info('Unregistered successfully');
  } catch (err) {
    logger.sw.warn('Unregister failed', { error: err });
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
