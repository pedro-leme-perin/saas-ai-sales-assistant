// =============================================
// 🧹 RETENTION POLICIES SERVICE (Session 51)
// =============================================

import apiClient from "@/lib/api-client";

export type RetentionResource =
  | "CALLS"
  | "WHATSAPP_CHATS"
  | "AUDIT_LOGS"
  | "AI_SUGGESTIONS"
  | "CSAT_RESPONSES"
  | "NOTIFICATIONS";

export interface RetentionPolicy {
  id: string;
  companyId: string;
  resource: RetentionResource;
  retentionDays: number;
  isActive: boolean;
  lastRunAt: string | null;
  lastDeletedCount: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertRetentionPolicyInput {
  resource: RetentionResource;
  retentionDays: number;
  isActive?: boolean;
}

export const MIN_RETENTION_DAYS: Record<RetentionResource, number> = {
  CALLS: 7,
  WHATSAPP_CHATS: 7,
  AUDIT_LOGS: 180,
  AI_SUGGESTIONS: 7,
  CSAT_RESPONSES: 7,
  NOTIFICATIONS: 7,
};

export const RETENTION_RESOURCES: RetentionResource[] = [
  "CALLS",
  "WHATSAPP_CHATS",
  "AUDIT_LOGS",
  "AI_SUGGESTIONS",
  "CSAT_RESPONSES",
  "NOTIFICATIONS",
];

export const retentionPoliciesService = {
  list: async () => {
    const res = await apiClient.get<{ data: RetentionPolicy[] }>(`/retention-policies`);
    return res.data;
  },
  upsert: (input: UpsertRetentionPolicyInput) =>
    apiClient.put<RetentionPolicy>(`/retention-policies`, input),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/retention-policies/${id}`),
};
