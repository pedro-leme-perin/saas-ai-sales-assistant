'use client';

import { useEffect } from 'react';
import { registerServiceWorker, onOnlineStatusChange } from '@/lib/register-sw';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Service Worker registration component
 * Registers the SW on mount and handles offline notifications
 */
export function ServiceWorkerRegistrar() {
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Register service worker with update and offline handlers
    registerServiceWorker({
      onUpdate: () => {
        // SW update available — notify user
        toast({
          title: t('notifications.sw_update_title') || 'Update available',
          description: t('notifications.sw_update_description') || 'The app has been updated. Refresh to get the latest version.',
          action: {
            label: t('actions.refresh') || 'Refresh',
            onClick: () => window.location.reload(),
          },
        });
      },
      onOffline: (error) => {
        console.warn('[SW] Registration error:', error);
        // Silently fail in production
      },
    });

    // Monitor online/offline status
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      if (!isOnline) {
        toast({
          title: t('notifications.offline_title') || 'You are offline',
          description: t('notifications.offline_description') || 'Some features may be unavailable. Changes will sync when reconnected.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('notifications.online_title') || 'Back online',
          description: t('notifications.online_description') || 'Syncing your data...',
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [toast, t]);

  // This component doesn't render anything
  return null;
}
