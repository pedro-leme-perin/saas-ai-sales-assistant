import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Criar instância do axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  async (config) => {
    // Pegar token do Clerk (no client-side)
    if (typeof window !== 'undefined') {
      try {
        // Aguardar o Clerk carregar completamente
        if (window.Clerk) {
          // Verificar se tem sessão ativa
          if (window.Clerk.session) {
            const token = await window.Clerk.session.getToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
              console.log('✅ Token adicionado ao header:', token.substring(0, 20) + '...');
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
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado
      console.error('Unauthorized - but not redirecting to avoid loops');
      // COMENTADO PARA EVITAR LOOPS
      // if (typeof window !== 'undefined') {
      //   window.location.href = '/sign-in';
      // }
    }
    return Promise.reject(error);
  }
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
// Dashboard
  async getDashboardStats(token: string): Promise<DashboardStats> {
    try {
      // Configurar token no header desta requisição específica
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      
      // Buscar dados do usuário autenticado
      const userResponse = await api.get('/api/auth/me', config);
      const companyId = userResponse.data.companyId;

      if (!companyId) {
        console.warn('No companyId found for user');
        return {
          totalCalls: 0,
          totalWhatsAppChats: 0,
          totalAISuggestions: 0,
        };
      }

      // Buscar estatísticas da empresa
      const statsResponse = await api.get(`/api/companies/${companyId}/stats`, config);
      
      return {
        totalCalls: statsResponse.data.totalCalls || 0,
        totalWhatsAppChats: statsResponse.data.totalChats || 0,
        totalAISuggestions: 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalCalls: 0,
        totalWhatsAppChats: 0,
        totalAISuggestions: 0,
      };
    }
  },

  // Calls
  async getCalls(): Promise<Call[]> {
    const response = await api.get('/api/calls');
    return response.data.data || [];
  },

  async createCall(data: { phoneNumber: string; direction: 'INBOUND' | 'OUTBOUND' }): Promise<Call> {
    const response = await api.post('/api/calls', data);
    return response.data.data;
  },

  // Company
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