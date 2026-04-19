// =============================================
// 🔑 API KEYS SERVICE (Session 47)
// =============================================

import apiClient from "@/lib/api-client";

export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  rateLimitPerMin: number | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  revokedAt: string | null;
  createdById: string | null;
}

export interface IssuedApiKey extends Omit<ApiKeyView, "lastUsedAt" | "usageCount" | "revokedAt" | "createdById"> {
  plaintextKey: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
  rateLimitPerMin?: number;
  expiresAt?: string;
}

export interface UpdateApiKeyInput {
  name?: string;
  scopes?: string[];
  isActive?: boolean;
  rateLimitPerMin?: number;
  expiresAt?: string;
}

export const apiKeysService = {
  list: async () => {
    const res = await apiClient.get<{ data: ApiKeyView[] }>(`/api-keys`);
    return res.data;
  },
  findById: (id: string) => apiClient.get<ApiKeyView>(`/api-keys/${id}`),
  create: (input: CreateApiKeyInput) => apiClient.post<IssuedApiKey>(`/api-keys`, input),
  update: (id: string, input: UpdateApiKeyInput) =>
    apiClient.patch<ApiKeyView>(`/api-keys/${id}`, input),
  revoke: (id: string) => apiClient.delete<{ success: true }>(`/api-keys/${id}`),
  rotate: (id: string) => apiClient.post<IssuedApiKey>(`/api-keys/${id}/rotate`, {}),
};

export const API_KEY_SCOPES = [
  "calls:read",
  "calls:write",
  "whatsapp:read",
  "whatsapp:write",
  "analytics:read",
  "webhooks:read",
  "webhooks:write",
  "templates:read",
  "templates:write",
  "tags:read",
  "tags:write",
] as const;
