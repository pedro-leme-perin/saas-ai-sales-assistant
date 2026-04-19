// =============================================
// 🏷️ TAGS SERVICE (Session 47)
// =============================================

import apiClient from "@/lib/api-client";

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  callCount?: number;
  chatCount?: number;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
}

export type UpdateTagInput = Partial<CreateTagInput>;

export type SearchScope = "CALL" | "CHAT" | "BOTH";

export interface ConversationHit {
  kind: "call" | "chat";
  id: string;
  preview: string;
  matchedAt: string;
  contactName: string | null;
  phoneNumber: string | null;
  tagIds: string[];
}

export interface SearchResult {
  calls: ConversationHit[];
  chats: ConversationHit[];
}

export interface SearchInput {
  q?: string;
  scope?: SearchScope;
  tagIds?: string[];
  limit?: number;
}

export const tagsService = {
  list: async () => {
    const res = await apiClient.get<{ data: ConversationTag[] }>(`/tags`);
    return res.data;
  },

  create: (input: CreateTagInput) => apiClient.post<ConversationTag>(`/tags`, input),

  update: (id: string, input: UpdateTagInput) =>
    apiClient.patch<ConversationTag>(`/tags/${id}`, input),

  remove: (id: string) => apiClient.delete<{ success: true }>(`/tags/${id}`),

  listCallTags: async (callId: string) => {
    const res = await apiClient.get<{ data: ConversationTag[] }>(`/calls/${callId}/tags`);
    return res.data;
  },

  attachToCall: (callId: string, tagIds: string[]) =>
    apiClient.post<{ success: true; attached: number }>(`/calls/${callId}/tags`, { tagIds }),

  detachFromCall: (callId: string, tagId: string) =>
    apiClient.delete<{ success: true }>(`/calls/${callId}/tags/${tagId}`),

  listChatTags: async (chatId: string) => {
    const res = await apiClient.get<{ data: ConversationTag[] }>(
      `/whatsapp/chats/${chatId}/tags`,
    );
    return res.data;
  },

  attachToChat: (chatId: string, tagIds: string[]) =>
    apiClient.post<{ success: true; attached: number }>(
      `/whatsapp/chats/${chatId}/tags`,
      { tagIds },
    ),

  detachFromChat: (chatId: string, tagId: string) =>
    apiClient.delete<{ success: true }>(`/whatsapp/chats/${chatId}/tags/${tagId}`),

  search: async (input: SearchInput) => {
    const qs = new URLSearchParams();
    if (input.q) qs.set("q", input.q);
    if (input.scope) qs.set("scope", input.scope);
    if (input.tagIds && input.tagIds.length > 0) qs.set("tagIds", input.tagIds.join(","));
    if (input.limit) qs.set("limit", String(input.limit));
    return apiClient.get<SearchResult>(
      `/search/conversations${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
  },
};
