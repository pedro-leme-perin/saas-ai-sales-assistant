// =============================================
// 🎭 Impersonation service (Session 58 — Feature A1)
// =============================================

import { apiClient } from "@/lib/api-client";

export interface StartImpersonationResult {
  sessionId: string;
  token: string;
  targetUserId: string;
  targetUserName: string | null;
  targetUserEmail: string;
  expiresAt: string;
}

export interface StartImpersonationPayload {
  targetUserId: string;
  reason: string;
  durationMinutes?: number;
}

export interface ImpersonationSession {
  id: string;
  companyId: string;
  actorUserId: string;
  targetUserId: string;
  reason: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  isActive: boolean;
  endedAt: string | null;
  endedReason: string | null;
  createdAt: string;
}

export interface ImpersonationSessionDetail extends ImpersonationSession {
  actor: { id: string; name: string | null; email: string } | null;
  target: { id: string; name: string | null; email: string } | null;
}

async function start(
  payload: StartImpersonationPayload,
): Promise<StartImpersonationResult> {
  return apiClient.post<StartImpersonationResult>("/impersonation/start", payload);
}

async function end(
  sessionId: string,
  reason?: string,
): Promise<{ ended: boolean }> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return apiClient.delete<{ ended: boolean }>(`/impersonation/${sessionId}${qs}`);
}

async function listActive(actorUserId?: string): Promise<ImpersonationSession[]> {
  const params = actorUserId ? { actorUserId } : undefined;
  const res = await apiClient.get<{ data: ImpersonationSession[] }>(
    "/impersonation/sessions",
    params,
  );
  return res.data ?? [];
}

async function findById(sessionId: string): Promise<ImpersonationSessionDetail> {
  return apiClient.get<ImpersonationSessionDetail>(
    `/impersonation/sessions/${sessionId}`,
  );
}

export const impersonationService = {
  start,
  end,
  listActive,
  findById,
};
