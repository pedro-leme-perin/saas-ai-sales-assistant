import axios from 'axios';
import { logger } from './logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const isServer = typeof window === 'undefined';
// Client-side: use Next.js rewrite proxy (same-origin, no CORS issues)
const API_BASE = isServer ? API_URL : '/api/backend';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.Clerk) {
          if (window.Clerk.session) {
            // skipCache: true → sempre busca token fresco, nunca usa cache expirado
            const token = await window.Clerk.session.getToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            } else {
              logger.auth.warn('Token is null');
            }
          } else {
            logger.auth.warn('Clerk session is null');
          }
        } else {
          logger.auth.warn('Clerk not initialized');
        }
      } catch (error) {
        logger.auth.error('Failed to get Clerk token', error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logger.auth.warn('Unauthorized - invalid or expired token');
    }
    return Promise.reject(error);
  },
);

// Tipos
export interface Call {
  id: string;
  phoneNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  duration: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  createdAt: string;
}

export interface DashboardStats {
  totalCalls: number;
  totalWhatsAppChats: number;
  totalAISuggestions: number;
}

// Funções de API
export const apiService = {
  async getDashboardStats(token: string): Promise<DashboardStats> {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const userResponse = await api.get('/api/auth/me', config);
      const companyId = userResponse.data.companyId;

      if (!companyId) {
        logger.api.warn('No companyId found for user');
        return { totalCalls: 0, totalWhatsAppChats: 0, totalAISuggestions: 0 };
      }

      const statsResponse = await api.get(`/api/companies/${companyId}/stats`, config);

      return {
        totalCalls: statsResponse.data.totalCalls || 0,
        totalWhatsAppChats: statsResponse.data.totalChats || 0,
        totalAISuggestions: 0,
      };
    } catch (error) {
      logger.api.error('Failed to fetch dashboard stats', error);
      return { totalCalls: 0, totalWhatsAppChats: 0, totalAISuggestions: 0 };
    }
  },

  async getCalls(): Promise<Call[]> {
    const response = await api.get('/api/calls');
    return response.data.data || [];
  },

  async createCall(data: { phoneNumber: string; direction: 'INBOUND' | 'OUTBOUND' }): Promise<Call> {
    const response = await api.post('/api/calls', data);
    return response.data.data;
  },

  async getCompany(): Promise<Company | null> {
    try {
      const response = await api.get('/api/companies');
      return response.data.data?.[0] || null;
    } catch (error) {
      logger.api.error('Failed to fetch company', error);
      return null;
    }
  },
};
