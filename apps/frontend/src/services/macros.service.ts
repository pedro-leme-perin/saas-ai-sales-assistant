// =============================================
// 🛠 MACROS SERVICE (Session 56 — Feature A2)
// =============================================
// 1-click compound actions on a WhatsApp chat.
// Action shape mirrors backend Zod discriminated union.

import apiClient from "@/lib/api-client";

export type MacroActionType =
  | "SEND_REPLY"
  | "ATTACH_TAG"
  | "ASSIGN_AGENT"
  | "CLOSE_CHAT";

export interface SendReplyAction {
  type: "SEND_REPLY";
  templateId: string;
  variables?: Record<string, string>;
}

export interface AttachTagAction {
  type: "ATTACH_TAG";
  tagId: string;
}

export interface AssignAgentAction {
  type: "ASSIGN_AGENT";
  userId: string | null; // null = unassign
}

export interface CloseChatAction {
  type: "CLOSE_CHAT";
  note?: string;
}

export type MacroAction =
  | SendReplyAction
  | AttachTagAction
  | AssignAgentAction
  | CloseChatAction;

export interface Macro {
  id: string;
  companyId: string;
  createdById: string | null;
  name: string;
  description: string | null;
  actions: MacroAction[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMacroInput {
  name: string;
  description?: string;
  actions: MacroAction[];
  isActive?: boolean;
}

export type UpdateMacroInput = Partial<CreateMacroInput>;

export interface ExecuteMacroResult {
  macroId: string;
  chatId: string;
  executed: Array<{
    type: MacroActionType;
    success: boolean;
    detail?: string;
  }>;
}

export const MAX_ACTIONS_PER_MACRO = 10;

export const macrosService = {
  list: async () => {
    const res = await apiClient.get<{ data: Macro[] }>(`/macros`);
    return res.data ?? (res as unknown as Macro[]);
  },
  findById: (id: string) => apiClient.get<Macro>(`/macros/${id}`),
  create: (dto: CreateMacroInput) => apiClient.post<Macro>(`/macros`, dto),
  update: (id: string, dto: UpdateMacroInput) =>
    apiClient.patch<Macro>(`/macros/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/macros/${id}`),
  execute: (id: string, chatId: string) =>
    apiClient.post<ExecuteMacroResult>(`/macros/${id}/execute`, { chatId }),
};
