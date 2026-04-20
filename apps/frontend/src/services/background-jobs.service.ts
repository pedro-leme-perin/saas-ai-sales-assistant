// =============================================
// ⚙️ BACKGROUND JOBS SERVICE (Session 49)
// =============================================

import apiClient from "@/lib/api-client";

export type BackgroundJobType =
  | "REGENERATE_CALL_SUMMARIES"
  | "RECOMPUTE_COACHING_REPORTS"
  | "BULK_DELETE_CALLS"
  | "BULK_TAG_CALLS"
  | "EXPORT_ANALYTICS";

export type BackgroundJobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELED";

export interface BackgroundJob {
  id: string;
  companyId: string;
  createdById: string | null;
  type: BackgroundJobType;
  status: BackgroundJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueJobInput {
  type: BackgroundJobType;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export const backgroundJobsService = {
  list: async (filters?: { status?: BackgroundJobStatus; type?: BackgroundJobType; limit?: number }) => {
    const qs = new URLSearchParams();
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.type) qs.set("type", filters.type);
    if (filters?.limit) qs.set("limit", String(filters.limit));
    const path = qs.toString() ? `/background-jobs?${qs.toString()}` : `/background-jobs`;
    const res = await apiClient.get<{ data: BackgroundJob[] }>(path);
    return res.data;
  },

  findById: (id: string) => apiClient.get<BackgroundJob>(`/background-jobs/${id}`),

  enqueue: (input: EnqueueJobInput) =>
    apiClient.post<BackgroundJob>(`/background-jobs`, input),

  retry: (id: string) => apiClient.post<BackgroundJob>(`/background-jobs/${id}/retry`, {}),

  cancel: (id: string) => apiClient.post<BackgroundJob>(`/background-jobs/${id}/cancel`, {}),
};
