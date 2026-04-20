// =============================================
// 🚩 FEATURE FLAGS SERVICE (Session 53)
// =============================================

import apiClient from "@/lib/api-client";

export interface FeatureFlag {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  userAllowlist: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  userAllowlist?: string[];
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  userAllowlist?: string[];
}

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  reason: "not_found" | "disabled" | "allowlist" | "rollout_hit" | "rollout_miss";
}

export const featureFlagsService = {
  list: async () => {
    const res = await apiClient.get<{ data: FeatureFlag[] }>(`/feature-flags`);
    return res.data ?? (res as unknown as FeatureFlag[]);
  },
  findById: (id: string) => apiClient.get<FeatureFlag>(`/feature-flags/${id}`),
  create: (dto: CreateFeatureFlagInput) =>
    apiClient.post<FeatureFlag>(`/feature-flags`, dto),
  update: (id: string, dto: UpdateFeatureFlagInput) =>
    apiClient.patch<FeatureFlag>(`/feature-flags/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/feature-flags/${id}`),
  evaluate: (key: string, userId?: string) =>
    apiClient.get<FlagEvaluation>(
      `/feature-flags/evaluate/${encodeURIComponent(key)}`,
      userId ? { userId } : undefined,
    ),
};
