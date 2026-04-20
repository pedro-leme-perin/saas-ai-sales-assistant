// =============================================
// 🎯 ASSIGNMENT RULES SERVICE (Session 54)
// =============================================

import apiClient from "@/lib/api-client";

export type AssignmentStrategy = "ROUND_ROBIN" | "LEAST_BUSY" | "MANUAL_ONLY";
export type ChatPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface AssignmentConditions {
  priority?: ChatPriority;
  tags?: string[];
  phonePrefix?: string;
  keywordsAny?: string[];
}

export interface AssignmentRule {
  id: string;
  companyId: string;
  createdById: string | null;
  name: string;
  priority: number;
  strategy: AssignmentStrategy;
  conditions: AssignmentConditions;
  targetUserIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentRuleInput {
  name: string;
  priority: number;
  strategy: AssignmentStrategy;
  conditions: AssignmentConditions;
  targetUserIds: string[];
  isActive?: boolean;
}

export type UpdateAssignmentRuleInput = Partial<CreateAssignmentRuleInput>;

export const assignmentRulesService = {
  list: async () => {
    const res = await apiClient.get<{ data: AssignmentRule[] }>(
      `/assignment-rules`,
    );
    return res.data ?? (res as unknown as AssignmentRule[]);
  },
  findById: (id: string) =>
    apiClient.get<AssignmentRule>(`/assignment-rules/${id}`),
  create: (dto: CreateAssignmentRuleInput) =>
    apiClient.post<AssignmentRule>(`/assignment-rules`, dto),
  update: (id: string, dto: UpdateAssignmentRuleInput) =>
    apiClient.patch<AssignmentRule>(`/assignment-rules/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/assignment-rules/${id}`),
};
