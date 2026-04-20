// =============================================
// ⭐ CSAT SERVICE (Session 50)
// =============================================

import apiClient from "@/lib/api-client";

export type CsatTrigger = "CALL_END" | "CHAT_CLOSE";
export type CsatChannel = "WHATSAPP" | "EMAIL";
export type CsatResponseStatus = "SCHEDULED" | "SENT" | "RESPONDED" | "EXPIRED" | "FAILED";

export interface CsatSurveyConfig {
  id: string;
  companyId: string;
  trigger: CsatTrigger;
  delayMinutes: number;
  channel: CsatChannel;
  messageTpl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCsatConfigInput {
  trigger: CsatTrigger;
  delayMinutes: number;
  channel: CsatChannel;
  messageTpl: string;
  isActive?: boolean;
}

export interface CsatResponse {
  id: string;
  companyId: string;
  contactId: string | null;
  callId: string | null;
  chatId: string | null;
  trigger: CsatTrigger;
  channel: CsatChannel;
  token: string;
  score: number | null;
  comment: string | null;
  status: CsatResponseStatus;
  scheduledFor: string;
  sentAt: string | null;
  respondedAt: string | null;
  expiresAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CsatAnalytics {
  total: number;
  responded: number;
  responseRate: number;
  avgScore: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface ListCsatResponsesResponse {
  data: CsatResponse[];
  nextCursor: string | null;
}

export interface CsatPublicLookup {
  status: CsatResponseStatus;
  companyName: string | null;
  trigger: CsatTrigger;
  score: number | null;
  comment: string | null;
}

export const csatService = {
  listConfigs: async () => {
    const res = await apiClient.get<{ data: CsatSurveyConfig[] }>(`/csat/configs`);
    return res.data;
  },

  upsertConfig: (input: UpsertCsatConfigInput) =>
    apiClient.put<CsatSurveyConfig>(`/csat/configs`, input),

  removeConfig: (id: string) =>
    apiClient.delete<{ success: true }>(`/csat/configs/${id}`),

  listResponses: (params: { status?: CsatResponseStatus; limit?: number; cursor?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    return apiClient.get<ListCsatResponsesResponse>(
      `/csat/responses${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
  },

  analytics: (params: { since?: string; until?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.since) qs.set("since", params.since);
    if (params.until) qs.set("until", params.until);
    return apiClient.get<CsatAnalytics>(
      `/csat/analytics${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
  },

  // Public (no auth) — use raw fetch to bypass auth interceptors
  publicLookup: async (token: string): Promise<CsatPublicLookup> => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${base}/csat/public/${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
    const body = await res.json();
    return body.data ?? body;
  },

  publicSubmit: async (
    token: string,
    score: number,
    comment?: string,
  ): Promise<{ success: true }> => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${base}/csat/public/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, comment }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Submit failed: ${res.status}`);
    }
    const body = await res.json();
    return body.data ?? body;
  },
};
