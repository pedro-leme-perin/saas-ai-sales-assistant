// =============================================
// 📅 SCHEDULED MESSAGES SERVICE (Session 56 — Feature A1)
// =============================================

import apiClient from "@/lib/api-client";

export type ScheduledMessageStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "CANCELED";

export interface ScheduledMessage {
  id: string;
  companyId: string;
  chatId: string;
  createdById: string | null;
  content: string;
  mediaUrl: string | null;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  jobId: string | null;
  sentAt: string | null;
  runCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledMessageInput {
  content: string;
  mediaUrl?: string;
  scheduledAt: string; // ISO-8601 UTC
}

export interface ListScheduledMessagesFilters {
  chatId?: string;
  status?: ScheduledMessageStatus;
  limit?: number;
}

export const MIN_LEAD_SECONDS = 30;

export const scheduledMessagesService = {
  schedule: (chatId: string, input: CreateScheduledMessageInput) =>
    apiClient.post<ScheduledMessage>(
      `/whatsapp/chats/${chatId}/schedule`,
      input,
    ),
  list: async (filters: ListScheduledMessagesFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.chatId) params.set("chatId", filters.chatId);
    if (filters.status) params.set("status", filters.status);
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const res = await apiClient.get<{ data: ScheduledMessage[] }>(
      `/scheduled-messages${qs ? `?${qs}` : ""}`,
    );
    return res.data ?? (res as unknown as ScheduledMessage[]);
  },
  findById: (id: string) =>
    apiClient.get<ScheduledMessage>(`/scheduled-messages/${id}`),
  cancel: (id: string) =>
    apiClient.delete<ScheduledMessage>(`/scheduled-messages/${id}`),
};
