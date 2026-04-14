'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () =>
          import('@tanstack/react-query-devtools').then((m) => ({
            default: m.ReactQueryDevtools,
          })),
        { ssr: false },
      )
    : null;
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
import { logger } from '@/lib/logger';

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
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
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

          wsClient.onNotification((data: unknown) => {
            const d = data as Record<string, unknown>;
            addNotification((d.notification || d) as Parameters<typeof addNotification>[0]);
          });

          wsClient.onAISuggestion((data: unknown) => {
            const d = data as Record<string, unknown>;
            addSuggestion(d as Parameters<typeof addSuggestion>[0]);
            if (d.transcript) {
              addTranscriptEntry({ text: d.transcript as string, speaker: 'customer' });
            }
          });
        }
      } catch (error) {
        logger.auth.error('Auth sync failed', error);
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
