import { apiClient } from "@/lib/api-client";

export type AgentStatus = "ONLINE" | "AWAY" | "BREAK" | "OFFLINE";

export interface PresenceRow {
  id: string;
  userId: string;
  companyId: string;
  status: AgentStatus;
  statusMessage: string | null;
  maxConcurrentChats: number;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export interface CapacityInfo {
  userId: string;
  status: AgentStatus;
  isOnline: boolean;
  atCapacity: boolean;
  maxConcurrentChats: number;
  currentOpen: number;
  lastHeartbeatAt: string | null;
}

export interface HeartbeatPayload {
  status?: AgentStatus;
  statusMessage?: string | null;
  maxConcurrentChats?: number;
}

export interface UpdatePresencePayload {
  status?: AgentStatus;
  statusMessage?: string | null;
  maxConcurrentChats?: number;
}

async function heartbeat(payload: HeartbeatPayload = {}): Promise<PresenceRow> {
  return apiClient.post<PresenceRow>("/presence/heartbeat", payload);
}

async function findMine(): Promise<PresenceRow> {
  return apiClient.get<PresenceRow>("/presence/me");
}

async function updateMine(payload: UpdatePresencePayload): Promise<PresenceRow> {
  return apiClient.patch<PresenceRow>("/presence/me", payload);
}

async function listActive(): Promise<PresenceRow[]> {
  const res = await apiClient.get<{ data: PresenceRow[] }>("/presence/active");
  return res.data ?? [];
}

async function findForUser(userId: string): Promise<PresenceRow> {
  return apiClient.get<PresenceRow>(`/presence/users/${userId}`);
}

async function capacityFor(userId: string): Promise<CapacityInfo> {
  return apiClient.get<CapacityInfo>(`/presence/users/${userId}/capacity`);
}

export const presenceService = {
  heartbeat,
  findMine,
  updateMine,
  listActive,
  findForUser,
  capacityFor,
};
