// =============================================
// 📑 REPLY TEMPLATES SERVICE (Session 46)
// =============================================

import apiClient from "@/lib/api-client";

export type ReplyTemplateChannel = "CALL" | "WHATSAPP" | "BOTH";

export interface ReplyTemplate {
  id: string;
  name: string;
  channel: ReplyTemplateChannel;
  category: string | null;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RankedReplyTemplate extends ReplyTemplate {
  score: number;
  reason: string;
}

export interface CreateReplyTemplateInput {
  name: string;
  channel: ReplyTemplateChannel;
  category?: string;
  content: string;
  variables?: string[];
  isActive?: boolean;
}

export interface UpdateReplyTemplateInput {
  name?: string;
  channel?: ReplyTemplateChannel;
  category?: string;
  content?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface SuggestReplyTemplateInput {
  channel: ReplyTemplateChannel;
  context: string;
  category?: string;
}

export const replyTemplatesService = {
  list: async (channel?: ReplyTemplateChannel, category?: string) => {
    const qs = new URLSearchParams();
    if (channel) qs.set("channel", channel);
    if (category) qs.set("category", category);
    const res = await apiClient.get<{ data: ReplyTemplate[] }>(
      `/reply-templates${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
    return res.data;
  },

  findById: async (id: string) =>
    apiClient.get<ReplyTemplate>(`/reply-templates/${id}`),

  create: async (input: CreateReplyTemplateInput) =>
    apiClient.post<ReplyTemplate>(`/reply-templates`, input),

  update: async (id: string, input: UpdateReplyTemplateInput) =>
    apiClient.patch<ReplyTemplate>(`/reply-templates/${id}`, input),

  remove: async (id: string) =>
    apiClient.delete<{ success: true }>(`/reply-templates/${id}`),

  markUsed: async (id: string) =>
    apiClient.post<ReplyTemplate>(`/reply-templates/${id}/used`, {}),

  suggest: async (input: SuggestReplyTemplateInput) => {
    const res = await apiClient.post<{ data: RankedReplyTemplate[] }>(
      `/reply-templates/suggest`,
      input,
    );
    return res.data;
  },
};

/**
 * Apply {{var}} interpolation against a map of values, leaving missing vars
 * as-is so the vendor can notice and fill manually.
 */
export function applyTemplateVariables(
  content: string,
  values: Record<string, string>,
): string {
  return content.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => {
    return values[name] ?? `{{${name}}}`;
  });
}
