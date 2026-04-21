import { apiClient } from "@/lib/api-client";
import type { ChatPriority } from "./sla-policies.service";

export type SlaEscalationAction =
  | "NOTIFY_MANAGER"
  | "REASSIGN_TO_USER"
  | "CHANGE_PRIORITY";

export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "VENDOR";

export interface SlaEscalation {
  id: string;
  policyId: string;
  level: number;
  triggerAfterMins: number;
  action: SlaEscalationAction;
  targetUserIds: string[];
  targetPriority: ChatPriority | null;
  notifyRoles: UserRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlaEscalationPayload {
  policyId: string;
  level: number;
  triggerAfterMins: number;
  action: SlaEscalationAction;
  targetUserIds?: string[];
  targetPriority?: ChatPriority;
  notifyRoles?: UserRole[];
  isActive?: boolean;
}

export interface UpdateSlaEscalationPayload {
  level?: number;
  triggerAfterMins?: number;
  action?: SlaEscalationAction;
  targetUserIds?: string[];
  targetPriority?: ChatPriority | null;
  notifyRoles?: UserRole[];
  isActive?: boolean;
}

async function list(policyId?: string): Promise<SlaEscalation[]> {
  const params = policyId ? { policyId } : undefined;
  const res = await apiClient.get<{ data: SlaEscalation[] }>(
    "/sla-escalations",
    params
  );
  return res.data ?? [];
}

async function findById(id: string): Promise<SlaEscalation> {
  return apiClient.get<SlaEscalation>(`/sla-escalations/${id}`);
}

async function create(
  payload: CreateSlaEscalationPayload
): Promise<SlaEscalation> {
  return apiClient.post<SlaEscalation>("/sla-escalations", payload);
}

async function update(
  id: string,
  payload: UpdateSlaEscalationPayload
): Promise<SlaEscalation> {
  return apiClient.patch<SlaEscalation>(`/sla-escalations/${id}`, payload);
}

async function remove(id: string): Promise<void> {
  await apiClient.delete<void>(`/sla-escalations/${id}`);
}

export const slaEscalationsService = {
  list,
  findById,
  create,
  update,
  remove,
};
