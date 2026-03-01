import apiClient from '@/lib/api-client';
import type {
  User,
  Company,
  Call,
  WhatsAppChat,
  WhatsAppMessage,
  AISuggestion,
  Notification,
  CompanyStats,
  CompanyUsage,
  CallStats,
  PlanDetails,
  PaginatedResponse,
} from '@/types';

// =============================================
// AUTH SERVICE
// =============================================

export const authService = {
  async getMe(): Promise<User & { companyId: string }> {
    const user = await apiClient.get<User & { companyId: string }>('/auth/me');
    apiClient.setCompanyId(user.companyId);
    return user;
  },
};

// =============================================
// USERS SERVICE
// =============================================

export const usersService = {
  async getAll(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<User>> {
    return apiClient.get('/users', params);
  },

  async getById(id: string): Promise<User> {
    return apiClient.get(`/users/${id}`);
  },

  async create(data: { email: string; name: string; role?: string }): Promise<User> {
    return apiClient.post('/users', data);
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    return apiClient.put(`/users/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/users/${id}`);
  },
};

// =============================================
// COMPANIES SERVICE
// =============================================

export const companiesService = {
  async getCurrent(): Promise<Company> {
    return apiClient.get('/companies/current');
  },

  async getStats(): Promise<CompanyStats> {
    return apiClient.get('/companies/current/stats');
  },

  async getUsage(): Promise<CompanyUsage> {
    return apiClient.get('/companies/current/usage');
  },

  async update(data: Partial<Company>): Promise<Company> {
    return apiClient.put('/companies/current', data);
  },
};

// =============================================
// CALLS SERVICE
// =============================================

export const callsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: string;
    direction?: string;
    search?: string;
  }): Promise<{ data: Call[]; meta: { total: number } }> {
    const companyId = apiClient.getCompanyId();
    if (!companyId) {
      await authService.getMe();
    }
    const calls = await apiClient.get<Call[]>(`/calls/${apiClient.getCompanyId()}`);
    return { data: calls, meta: { total: calls.length } };
  },

  async getById(id: string): Promise<Call> {
    const companyId = apiClient.getCompanyId();
    return apiClient.get(`/calls/${companyId}/${id}`);
  },

  async getActive(): Promise<Call[]> {
    const companyId = apiClient.getCompanyId();
    const calls = await apiClient.get<Call[]>(`/calls/${companyId}`);
    return calls.filter(c => c.status === 'IN_PROGRESS');
  },

  async getStats(): Promise<CallStats> {
    const companyId = apiClient.getCompanyId();
    if (!companyId) {
      await authService.getMe();
    }
    const calls = await apiClient.get<Call[]>(`/calls/${apiClient.getCompanyId()}`);
    
    const total = calls.length;
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    
    calls.forEach(call => {
      byStatus[call.status] = (byStatus[call.status] || 0) + 1;
      totalDuration += call.duration || 0;
    });
    
   return {
     total,
     byStatus,
     byDirection: {},
     totalDuration,
     avgDuration: total > 0 ? Math.round(totalDuration / total) : 0,
   };
 },

  async create(data: {
    phoneNumber: string;
    contactName?: string;
    direction?: string;
  }): Promise<Call> {
    const companyId = apiClient.getCompanyId();
    return apiClient.post(`/calls/${companyId}`, data);
  },

  async update(id: string, data: Partial<Call>): Promise<Call> {
    const companyId = apiClient.getCompanyId();
    return apiClient.put(`/calls/${companyId}/${id}`, data);
  },

  async addTranscript(
    id: string,
    data: { speaker: 'customer' | 'vendor'; text: string }
  ): Promise<Call> {
    const companyId = apiClient.getCompanyId();
    return apiClient.post(`/calls/${companyId}/${id}/transcript`, data);
  },

  async complete(id: string): Promise<Call> {
    const companyId = apiClient.getCompanyId();
    return apiClient.post(`/calls/${companyId}/${id}/complete`);
  },

  async getSuggestions(id: string): Promise<AISuggestion[]> {
    const companyId = apiClient.getCompanyId();
    return apiClient.get(`/calls/${companyId}/${id}/suggestions`);
  },

  async delete(id: string): Promise<void> {
    const companyId = apiClient.getCompanyId();
    return apiClient.delete(`/calls/${companyId}/${id}`);
  },
};

// =============================================
// WHATSAPP SERVICE
// =============================================

export const whatsappService = {
  async getChats(params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<{ data: WhatsAppChat[]; meta: { total: number } }> {
    const companyId = apiClient.getCompanyId();
    if (!companyId) {
      await authService.getMe();
    }
    const chats = await apiClient.get<WhatsAppChat[]>(`/whatsapp/chats/${apiClient.getCompanyId()}`);
    return { data: chats, meta: { total: chats.length } };
  },

  async getChatById(id: string): Promise<WhatsAppChat> {
    const companyId = apiClient.getCompanyId();
    return apiClient.get(`/whatsapp/chats/${companyId}/${id}`);
  },

  async getActiveChats(): Promise<WhatsAppChat[]> {
    const companyId = apiClient.getCompanyId();
    const chats = await apiClient.get<WhatsAppChat[]>(`/whatsapp/chats/${companyId}`);
    return chats.filter(c => c.status === 'ACTIVE' || c.status === 'OPEN');
  },

  async createChat(data: {
    customerPhone: string;
    customerName?: string;
  }): Promise<WhatsAppChat> {
    const companyId = apiClient.getCompanyId();
    return apiClient.post(`/whatsapp/chats/${companyId}`, data);
  },

  async updateChat(id: string, data: Partial<WhatsAppChat>): Promise<WhatsAppChat> {
    const companyId = apiClient.getCompanyId();
    return apiClient.put(`/whatsapp/chats/${companyId}/${id}`, data);
  },

  async getMessages(
    chatId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ data: WhatsAppMessage[]; meta: { total: number } }> {
    const companyId = apiClient.getCompanyId();
    const messages = await apiClient.get<WhatsAppMessage[]>(`/whatsapp/chats/${companyId}/${chatId}/messages`);
    return { data: messages, meta: { total: messages.length } };
  },

  async sendMessage(
    chatId: string,
    data: { content: string; type?: string; aiSuggestionUsed?: boolean }
  ): Promise<WhatsAppMessage> {
    const companyId = apiClient.getCompanyId();
    return apiClient.post(`/whatsapp/chats/${companyId}/${chatId}/messages`, data);
  },

  async getSuggestion(chatId: string): Promise<AISuggestion> {
    const companyId = apiClient.getCompanyId();
    return apiClient.get(`/whatsapp/chats/${companyId}/${chatId}/suggestion`);
  },

  async getStats(): Promise<{
    totalChats: number;
    activeChats: number;
    totalMessages: number;
    avgResponseTime: string;
  }> {
    const companyId = apiClient.getCompanyId();
    if (!companyId) {
      await authService.getMe();
    }
    const chats = await apiClient.get<WhatsAppChat[]>(`/whatsapp/chats/${apiClient.getCompanyId()}`);
    
    return {
      totalChats: chats.length,
      activeChats: chats.filter(c => c.status === 'ACTIVE' || c.status === 'OPEN').length,
      totalMessages: 0,
      avgResponseTime: '0min',
    };
  },

  async deleteChat(id: string): Promise<void> {
    const companyId = apiClient.getCompanyId();
    return apiClient.delete(`/whatsapp/chats/${companyId}/${id}`);
  },
};

// =============================================
// AI SERVICE
// =============================================

export const aiService = {
  async generateSuggestion(data: {
    currentMessage: string;
    conversationHistory?: string;
    context?: 'phone_call' | 'whatsapp';
    customerSentiment?: 'positive' | 'neutral' | 'negative';
  }): Promise<AISuggestion> {
    return apiClient.post('/ai/suggestion', data);
  },

  async analyzeConversation(transcript: string): Promise<{
    sentiment: string;
    score: number;
    summary: string;
    keywords: string[];
    actionItems: string[];
  }> {
    return apiClient.post('/ai/analyze', { transcript });
  },

  async checkHealth(): Promise<{ status: string; provider: string; timestamp: string }> {
    return apiClient.get('/ai/health');
  },
};

// =============================================
// BILLING SERVICE
// =============================================

interface Invoice {
  id: string;
  amount: number;
  status: string;
  date: string;
  pdfUrl?: string;
}

interface Subscription {
  id: string;
  status: string;
  plan: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export const billingService = {
  async getSubscription(): Promise<Subscription | null> {
    return apiClient.get('/billing/subscription');
  },

  async getInvoices(): Promise<Invoice[]> {
    return apiClient.get('/billing/invoices');
  },

  async getPlans(): Promise<PlanDetails[]> {
    return apiClient.get('/billing/plans');
  },

  async createCheckout(plan: string): Promise<{ url: string }> {
    return apiClient.post('/billing/checkout', { plan });
  },

  async changePlan(plan: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/billing/change-plan', { plan });
  },

  async cancelSubscription(): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/billing/cancel');
  },

  async getPortalUrl(): Promise<{ url: string }> {
    return apiClient.get('/billing/portal');
  },
};

// =============================================
// NOTIFICATIONS SERVICE
// =============================================

export const notificationsService = {
  async getAll(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> {
    return apiClient.get('/notifications', params);
  },

  async getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get('/notifications/unread-count');
  },

  async markAsRead(id: string): Promise<Notification> {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    return apiClient.post('/notifications/read-all');
  },
};

