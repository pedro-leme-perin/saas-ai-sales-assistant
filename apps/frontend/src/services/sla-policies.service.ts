// =============================================
// ⏱️ SLA POLICIES SERVICE (Session 49)
// =============================================

import apiClient from "@/lib/api-client";

export type ChatPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface SlaPolicy {
  id: string;
  companyId: string;
  name: string;
  priority: ChatPriority;
  responseMins: number;
  resolutionMins: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSlaPolicyInput {
  name: string;
  priority: ChatPriority;
  responseMins: number;
  resolutionMins: number;
  isActive?: boolean;
}

export const slaPoliciesService = {
  list: async () => {
    const res = await apiClient.get<{ data: SlaPolicy[] }>(`/sla-policies`);
    return res.data;
  },

  findById: (id: string) => apiClient.get<SlaPolicy>(`/sla-policies/${id}`),

  upsert: (input: UpsertSlaPolicyInput) =>
    apiClient.put<SlaPolicy>(`/sla-policies`, input),

  remove: (id: string) => apiClient.delete<{ success: true }>(`/sla-policies/${id}`),
};
