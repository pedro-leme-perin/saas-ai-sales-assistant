// =============================================
// 📦 BULK ACTIONS SERVICE (Session 52)
// =============================================

import apiClient from "@/lib/api-client";

export interface BulkJobResponse {
  jobId: string;
  status: string;
}

export const bulkActionsService = {
  tagCalls: (callIds: string[], tagIds: string[]) =>
    apiClient.post<BulkJobResponse>(`/bulk/calls/tag`, { callIds, tagIds }),

  deleteCalls: (callIds: string[]) =>
    apiClient.post<BulkJobResponse>(`/bulk/calls/delete`, { callIds }),

  assignChats: (chatIds: string[], userId: string | null) =>
    apiClient.post<BulkJobResponse>(`/bulk/chats/assign`, { chatIds, userId }),
};
