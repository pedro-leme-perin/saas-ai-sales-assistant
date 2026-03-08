import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

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
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
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

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
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
