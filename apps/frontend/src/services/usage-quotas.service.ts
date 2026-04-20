// =============================================
// 📊 USAGE QUOTAS SERVICE (Session 55 — Feature A2)
// =============================================

import apiClient from "@/lib/api-client";

export type UsageMetric =
  | "CALLS"
  | "WHATSAPP_MESSAGES"
  | "AI_SUGGESTIONS"
  | "STORAGE_MB";

export interface UsageQuota {
  id: string;
  companyId: string;
  metric: UsageMetric;
  periodStart: string;
  periodEnd: string;
  limit: number;
  currentValue: number;
  warnedThresholds: number[];
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaCheck {
  metric: UsageMetric;
  used: number;
  limit: number;
  pct: number;
  isUnlimited: boolean;
  isNearLimit: boolean;
  isOverLimit: boolean;
  periodStart: string;
  periodEnd: string;
}

export interface UpsertQuotaLimitInput {
  metric: UsageMetric;
  limit: number;
}

export const usageQuotasService = {
  list: async () => {
    const res = await apiClient.get<{ data: UsageQuota[] }>(`/usage-quotas`);
    return res.data ?? (res as unknown as UsageQuota[]);
  },
  check: (metric: UsageMetric) =>
    apiClient.get<QuotaCheck>(`/usage-quotas/check/${metric}`),
  upsertLimit: (dto: UpsertQuotaLimitInput) =>
    apiClient.put<UsageQuota>(`/usage-quotas/limit`, dto),
};
