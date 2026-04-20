// =============================================
// 👤 CONTACTS SERVICE (Session 50)
// =============================================

import apiClient from "@/lib/api-client";

export interface Contact {
  id: string;
  companyId: string;
  phone: string;
  name: string | null;
  email: string | null;
  timezone: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastInteractionAt: string | null;
  totalCalls: number;
  totalChats: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactNote {
  id: string;
  contactId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type TimelineEvent =
  | { kind: "call"; id: string; at: string; data: Record<string, unknown> }
  | { kind: "chat"; id: string; at: string; data: Record<string, unknown> }
  | { kind: "note"; id: string; at: string; data: Record<string, unknown> };

export interface UpdateContactInput {
  name?: string;
  email?: string;
  timezone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface MergeContactsInput {
  primaryId: string;
  secondaryId: string;
}

export interface ListContactsResponse {
  data: Contact[];
  nextCursor: string | null;
}

export const contactsService = {
  list: (params: { q?: string; limit?: number; cursor?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    return apiClient.get<ListContactsResponse>(
      `/contacts${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
  },

  findById: (id: string) => apiClient.get<Contact>(`/contacts/${id}`),

  update: (id: string, input: UpdateContactInput) =>
    apiClient.patch<Contact>(`/contacts/${id}`, input),

  merge: (input: MergeContactsInput) =>
    apiClient.post<{ success: true; mergedId: string; removedId: string }>(
      `/contacts/merge`,
      input,
    ),

  timeline: async (id: string) => {
    const res = await apiClient.get<{ data: TimelineEvent[] }>(`/contacts/${id}/timeline`);
    return res.data;
  },

  listNotes: async (id: string) => {
    const res = await apiClient.get<{ data: ContactNote[] }>(`/contacts/${id}/notes`);
    return res.data;
  },

  addNote: (id: string, content: string) =>
    apiClient.post<ContactNote>(`/contacts/${id}/notes`, { content }),

  removeNote: (id: string, noteId: string) =>
    apiClient.delete<{ success: true }>(`/contacts/${id}/notes/${noteId}`),
};
