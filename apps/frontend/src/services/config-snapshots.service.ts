// =============================================
// 📸 Config snapshots service (Session 58 — Feature A2)
// =============================================

import { apiClient } from "@/lib/api-client";

export type ConfigResource =
  | "COMPANY_SETTINGS"
  | "FEATURE_FLAG"
  | "SLA_POLICY"
  | "ASSIGNMENT_RULE"
  | "NOTIFICATION_PREFERENCES";

export interface ConfigSnapshot {
  id: string;
  companyId: string;
  actorId: string | null;
  resource: ConfigResource;
  resourceId: string | null;
  label: string | null;
  snapshotData: unknown;
  createdAt: string;
}

export interface SnapshotDiff {
  snapshotId: string;
  resource: ConfigResource;
  resourceId: string | null;
  createdAt: string;
  snapshotData: unknown;
  currentData: unknown;
  changed: boolean;
}

export interface ListSnapshotsParams {
  resource?: ConfigResource;
  resourceId?: string;
  limit?: number;
}

export interface CreateSnapshotPayload {
  resource: ConfigResource;
  resourceId?: string;
  label?: string;
}

async function list(params?: ListSnapshotsParams): Promise<ConfigSnapshot[]> {
  const res = await apiClient.get<{ data: ConfigSnapshot[] }>(
    "/config-snapshots",
    params as Record<string, unknown>,
  );
  return res.data ?? [];
}

async function findById(id: string): Promise<ConfigSnapshot> {
  return apiClient.get<ConfigSnapshot>(`/config-snapshots/${id}`);
}

async function create(payload: CreateSnapshotPayload): Promise<ConfigSnapshot> {
  return apiClient.post<ConfigSnapshot>("/config-snapshots", payload);
}

async function diff(id: string): Promise<SnapshotDiff> {
  return apiClient.get<SnapshotDiff>(`/config-snapshots/${id}/diff`);
}

async function rollback(
  id: string,
): Promise<{ success: boolean; preRollbackSnapshotId: string }> {
  return apiClient.post<{ success: boolean; preRollbackSnapshotId: string }>(
    `/config-snapshots/${id}/rollback`,
    {},
  );
}

export const configSnapshotsService = {
  list,
  findById,
  create,
  diff,
  rollback,
};
