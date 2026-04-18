import apiClient from "@/lib/api-client";

export interface CoachingMetrics {
  calls: {
    total: number;
    completed: number;
    missed: number;
    avgDurationSeconds: number;
    conversionRate: number;
  };
  whatsapp: {
    chats: number;
    messagesSent: number;
    responseRateP50Minutes: number;
  };
  ai: {
    suggestionsShown: number;
    suggestionsUsed: number;
    adoptionRate: number;
  };
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface CoachingReport {
  id: string;
  companyId: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  metrics: CoachingMetrics;
  insights: string[];
  recommendations: string[];
  provider: string;
  emailSentAt: string | null;
  emailError: string | null;
  createdAt: string;
}

export interface CoachingListResponse {
  data: CoachingReport[];
  meta: { total: number };
}

export const coachingService = {
  listMine: async (limit = 12) =>
    apiClient.get<CoachingListResponse>(`/coaching/me?limit=${limit}`),

  getOne: async (id: string) => apiClient.get<CoachingReport>(`/coaching/${id}`),
};
