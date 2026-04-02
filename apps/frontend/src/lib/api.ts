import axios from 'axios';

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
              console.warn('⚠️ Token é null');
            }
          } else {
            console.warn('⚠️ Clerk.session é null');
          }
        } else {
          console.warn('⚠️ window.Clerk não está definido');
        }
      } catch (error) {
        console.error('❌ Erro ao pegar token do Clerk:', error);
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
      console.error('Unauthorized - token inválido ou expirado');
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
        console.warn('No companyId found for user');
        return { totalCalls: 0, totalWhatsAppChats: 0, totalAISuggestions: 0 };
      }

      const statsResponse = await api.get(`/api/companies/${companyId}/stats`, config);

      return {
        totalCalls: statsResponse.data.totalCalls || 0,
        totalWhatsAppChats: statsResponse.data.totalChats || 0,
        totalAISuggestions: 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
      console.error('Error fetching company:', error);
      return null;
    }
  },
};
