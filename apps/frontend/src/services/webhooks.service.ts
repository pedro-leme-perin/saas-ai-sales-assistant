// =============================================
// 🔔 WEBHOOKS SERVICE (Session 46)
// =============================================

import apiClient from "@/lib/api-client";

export type WebhookEvent =
  | "CALL_COMPLETED"
  | "CHAT_MESSAGE_RECEIVED"
  | "SUMMARY_READY"
  | "COACHING_REPORT_CREATED";

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "DEAD_LETTER";
  attempts: number;
  responseStatus: number | null;
  errorMessage: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
}

export interface CreateWebhookInput {
  url: string;
  description?: string;
  events: WebhookEvent[];
}

export interface UpdateWebhookInput {
  url?: string;
  description?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

export const webhooksService = {
  list: async () => {
    const res = await apiClient.get<{ data: WebhookEndpoint[] }>("/webhooks");
    return res.data;
  },

  listDeliveries: async (endpointId?: string, limit = 50) => {
    const qs = new URLSearchParams();
    if (endpointId) qs.set("endpointId", endpointId);
    qs.set("limit", String(limit));
    const res = await apiClient.get<{ data: WebhookDelivery[] }>(
      `/webhooks/deliveries?${qs.toString()}`,
    );
    return res.data;
  },

  create: async (input: CreateWebhookInput) =>
    apiClient.post<WebhookEndpoint>("/webhooks", input),

  update: async (id: string, input: UpdateWebhookInput) =>
    apiClient.patch<WebhookEndpoint>(`/webhooks/${id}`, input),

  remove: async (id: string) =>
    apiClient.delete<{ ok: true }>(`/webhooks/${id}`),

  rotateSecret: async (id: string) =>
    apiClient.post<{ id: string; secret: string; updatedAt: string }>(
      `/webhooks/${id}/rotate-secret`,
      {},
    ),
};
