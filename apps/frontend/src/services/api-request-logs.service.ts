// =============================================
// 📡 API REQUEST LOGS SERVICE (Session 52)
// =============================================

import apiClient from "@/lib/api-client";

export interface ApiRequestLogItem {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  apiKeyId: string | null;
  userId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ApiRequestLogsListResponse {
  items: ApiRequestLogItem[];
  nextCursor: string | null;
}

export interface ApiRequestLogsMetrics {
  windowHours: number;
  totalRequests: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  topPaths: Array<{ path: string; count: number; avgLatencyMs: number }>;
  statusDistribution: Array<{ bucket: string; count: number }>;
  byApiKey: Array<{ apiKeyId: string | null; count: number }>;
}

export interface ApiRequestLogsFilters {
  path?: string;
  method?: string;
  apiKeyId?: string;
  statusCode?: number;
  cursor?: string;
  limit?: number;
}

export const apiRequestLogsService = {
  list: async (filters: ApiRequestLogsFilters = {}) => {
    const qs = new URLSearchParams();
    if (filters.path) qs.set("path", filters.path);
    if (filters.method) qs.set("method", filters.method);
    if (filters.apiKeyId) qs.set("apiKeyId", filters.apiKeyId);
    if (filters.statusCode) qs.set("statusCode", String(filters.statusCode));
    if (filters.cursor) qs.set("cursor", filters.cursor);
    if (filters.limit) qs.set("limit", String(filters.limit));
    const path = qs.toString() ? `/api-request-logs?${qs.toString()}` : `/api-request-logs`;
    return apiClient.get<ApiRequestLogsListResponse>(path);
  },

  metrics: () => apiClient.get<ApiRequestLogsMetrics>(`/api-request-logs/metrics`),
};
