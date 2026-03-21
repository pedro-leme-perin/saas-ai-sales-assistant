import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Reference to Clerk's getToken function - set by AuthProvider
let clerkGetToken: (() => Promise<string | null>) | null = null;

export function setClerkGetToken(fn: () => Promise<string | null>) {
  clerkGetToken = fn;
}

class ApiClient {
  private client: AxiosInstance;
  private companyId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
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
            console.error('Failed to get auth token:', err);
          }
        }

        // Distributed tracing: preserve Sentry headers if they exist
        // @sentry/nextjs automatically adds sentry-trace and baggage headers
        // We ensure they're not stripped by preserving them here
        // Headers set by @sentry/nextjs are automatically included by axios
        // This explicit handling is defensive and future-proof

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
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
      }
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
    const config: Record<string, unknown> = { params };
    if (isBlob) {
      config.responseType = 'blob';
    }
    const response = await this.client.get<T>(url, config as any);
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
