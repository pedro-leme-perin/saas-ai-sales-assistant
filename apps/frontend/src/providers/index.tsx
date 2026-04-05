'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import apiClient, { setClerkGetToken } from '@/lib/api-client';
import { wsClient } from '@/lib/websocket';
import {
  useUserStore, useNotificationsStore,
  useAISuggestionsStore, useActiveCallStore, useUIStore,
} from '@/stores';
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

// =============================================
// THEME PROVIDER — aplica classe .dark no <html>
// =============================================
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system: respeita preferência do OS
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const applySystem = () => {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      applySystem();
      mediaQuery.addEventListener('change', applySystem);
      return () => mediaQuery.removeEventListener('change', applySystem);
    }
  }, [theme]);

  return <>{children}</>;
}

// =============================================
// PROVIDERS
// =============================================
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
      <Toaster position="top-right" richColors closeButton />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// =============================================
// AUTH PROVIDER
// =============================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { setUser, setCompany, setLoading, clear } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();
  const { addNotification } = useNotificationsStore();
  const { addSuggestion } = useAISuggestionsStore();
  const { addTranscriptEntry } = useActiveCallStore();

  // Register getToken so every API request gets a fresh JWT
  useEffect(() => {
    setClerkGetToken(getToken);
  }, [getToken]);

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

        const user = await authService.getMe();
        setUser(user);

        if (user.company) {
          setCompany(user.company);

          // Redirect to onboarding if not completed
          const metadata = user.company.metadata;
          const isOnboarded = metadata?.onboarded === true;
          if (!isOnboarded && !pathname.startsWith('/onboarding')) {
            router.push('/onboarding');
          }
        }
        if (user.companyId) {
          apiClient.setCompanyId(user.companyId);
        }

        // Connect WebSocket
        if (user && user.companyId) {
          wsClient.connect(user.id, user.companyId);

          wsClient.onNotification((data: any) => {
            addNotification(data.notification || data);
          });

          wsClient.onAISuggestion((data: any) => {
            addSuggestion(data);
            if (data.transcript) {
              addTranscriptEntry({ text: data.transcript, speaker: 'customer' });
            }
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
  }, [isLoaded, isSignedIn, getToken, setUser, setCompany, setLoading, clear, addNotification, addSuggestion, addTranscriptEntry, pathname, router]);

  return <>{children}</>;
}
