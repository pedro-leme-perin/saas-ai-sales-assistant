'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import apiClient from '@/lib/api-client';
import { wsClient } from '@/lib/websocket';
import { useUserStore, useNotificationsStore, useAISuggestionsStore } from '@/stores';
import { authService } from '@/services/api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { setUser, setCompany, setLoading, clear } = useUserStore();
  const { addNotification } = useNotificationsStore();
  const { addSuggestion } = useAISuggestionsStore();

  useEffect(() => {
    async function syncAuth() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        clear();
        wsClient.disconnect();
        return;
      }

      try {
        setLoading(true);

        // Get Clerk token
        const token = await getToken();
        if (token) {
          apiClient.setAuthToken(token);
        }

        // Fetch user from backend (includes company info)
        const user = await authService.getMe();
        setUser(user);

        // Set company from user response
        if (user.company) {
          setCompany(user.company);
        }

        // Connect WebSocket
        if (user && user.companyId) {
          wsClient.connect(token || undefined);
          wsClient.joinRoom(`user:${user.id}`);
          wsClient.joinRoom(`company:${user.companyId}`);

          wsClient.on('notification', (data: any) => {
            addNotification(data.notification);
          });

          wsClient.on('ai:suggestion', (data: any) => {
            addSuggestion(data.suggestion);
          });
        }
      } catch (error) {
        console.error('Auth sync error:', error);
        clear();
      } finally {
        setLoading(false);
      }
    }

    syncAuth();

    return () => {
      wsClient.disconnect();
    };
  }, [isLoaded, isSignedIn, getToken, setUser, setCompany, setLoading, clear, addNotification, addSuggestion]);

  return <>{children}</>;
}