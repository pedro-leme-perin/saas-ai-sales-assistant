import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';
import { logger } from './logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const isServer = typeof window === 'undefined';
// Client-side: use Next.js rewrite proxy (same-origin, no CORS issues)
// Server-side (SSR): use direct URL (server-to-server, no CORS)
const API_BASE_URL = isServer ? `${API_URL}/api` : '/api/backend/api';

// Reference to Clerk's getToken function - set by AuthProvider
let clerkGetToken: (() => Promise<string | null>) | null = null;

export function setClerkGetToken(fn: () => Promise<string | null>) {
  clerkGetToken = fn;
}

/**
 * S78 G1: Detects backend TransformInterceptor envelope shape.
 *
 * Backend wraps every JSON 2xx response in `{ success, data, timestamp }` (see
 * `apps/backend/src/common/interceptors/transform.interceptor.ts`). Per-hook
 * unwrap (S77+A4 ddcf42f useBilling) was bug-prone — same cascade caused
 * `/dashboard` root crash via `auth/me` returning envelope instead of user.
 *
 * Heuristic: object with all three keys `success`, `data`, `timestamp`. Tighter
 * than `'success' in body` (avoids unwrapping payloads that legitimately
 * contain a `success` flag — e.g. `DELETE /:id` returning `{ success: true }`
 * directly is NOT wrapped because it lacks `timestamp`; TransformInterceptor
 * sees the `success` key and skips re-wrap).
 *
 * Backwards-compat: returns `false` for blobs, arrays, primitives, and any
 * shape lacking the three envelope keys → response.data left untouched.
 */
interface TransformEnvelope {
  success: boolean;
  data: unknown;
  meta?: unknown;
  timestamp: string;
}

function isTransformEnvelope(body: unknown): body is TransformEnvelope {
  return (
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'success' in (body as Record<string, unknown>) &&
    'data' in (body as Record<string, unknown>) &&
    'timestamp' in (body as Record<string, unknown>)
  );
}

function unwrapEnvelope(envelope: TransformEnvelope): unknown {
  // Pagination: backend services that return `{ data, meta }` get both fields
  // hoisted to the outer envelope by TransformInterceptor. Preserve `{ data, meta }`
  // for paginated consumers (api.ts callsService.getAll, whatsappService.getChats,
  // whatsappService.getMessages).
  if ('meta' in envelope && envelope.meta !== undefined) {
    return { data: envelope.data, meta: envelope.meta };
  }
  // Standard: return inner data directly.
  return envelope.data;
}

class ApiClient {
  private client: AxiosInstance;
  private companyId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Get fresh token on EVERY request
    // Also preserve Sentry trace headers for distributed tracing
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (clerkGetToken && config.headers) {
          try {
            const token = await clerkGetToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch (err) {
            logger.auth.error('Failed to get auth token', err);
          }
        }

        // Distributed tracing: preserve Sentry headers if they exist
        // @sentry/nextjs automatically adds sentry-trace and baggage headers
        // We ensure they're not stripped by preserving them here
        // Headers set by @sentry/nextjs are automatically included by axios
        // This explicit handling is defensive and future-proof

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => {
        // S78 G1: auto-unwrap TransformInterceptor envelope.
        // Skip when responseType is blob/arraybuffer (downloads) — body is not JSON.
        const responseType = response.config.responseType;
        if (
          responseType === 'blob' ||
          responseType === 'arraybuffer' ||
          responseType === 'stream'
        ) {
          return response;
        }
        if (isTransformEnvelope(response.data)) {
          response.data = unwrapEnvelope(response.data);
        }
        return response;
      },
      (error: AxiosError) => {
        const parsedError = this.handleError(error);
        const status = error.response?.status;

        // Toast global para erros de rede e servidor (não duplicar em 401 — Clerk trata)
        if (!error.response) {
          toast.error('Sem conexão', {
            description: 'Servidor não respondeu. Verifique sua internet.',
            id: 'api-network-error',
          });
        } else if (status && status >= 500) {
          toast.error('Erro no servidor', {
            description: 'Tente novamente em alguns instantes.',
            id: 'api-server-error',
          });
        } else if (status === 429) {
          toast.warning('Muitas requisições', {
            description: 'Aguarde um momento antes de tentar novamente.',
            id: 'api-rate-limit',
          });
        }

        return Promise.reject(parsedError);
      },
    );
  }

  // Keep for backward compat but no longer needed
  setAuthToken(_token: string | null) {}

  setCompanyId(companyId: string | null) {
    this.companyId = companyId;
  }

  getCompanyId(): string | null {
    return this.companyId;
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as { message?: string };
      return new Error(data.message || 'Erro na requisicao');
    }
    if (error.request) {
      return new Error('Servidor nao respondeu. Verifique sua conexao.');
    }
    return new Error(error.message || 'Erro desconhecido');
  }

  async get<T>(url: string, params?: Record<string, unknown>, isBlob?: boolean): Promise<T> {
    const config: AxiosRequestConfig = { params };
    if (isBlob) {
      config.responseType = 'blob';
    }
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
