// =============================================
// DSAR service (Session 60a) — LGPD Art. 18
// =============================================

import { apiClient } from "@/lib/api-client";

export type DsarType =
  | "ACCESS"
  | "PORTABILITY"
  | "CORRECTION"
  | "DELETION"
  | "INFO";

export type DsarStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED";

export interface DsarCorrectionPayload {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
  reason?: string;
}

export interface DsarRequestRow {
  id: string;
  companyId: string;
  type: DsarType;
  status: DsarStatus;
  requesterEmail: string;
  requesterName: string | null;
  cpf: string | null;
  notes: string | null;
  correctionPayload: DsarCorrectionPayload | null;
  requestedById: string;
  approvedById: string | null;
  rejectedReason: string | null;
  jobId: string | null;
  downloadUrl: string | null;
  artifactKey: string | null;
  artifactBytes: number | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDsarPayload {
  type: DsarType;
  requesterEmail: string;
  requesterName?: string;
  cpf?: string;
  notes?: string;
  correctionPayload?: DsarCorrectionPayload;
}

export interface ListDsarFilters {
  status?: DsarStatus;
  type?: DsarType;
  requesterEmail?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListDsarResult {
  items: DsarRequestRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DownloadDsarResult {
  downloadUrl: string;
  expiresAt: string;
}

// Backend wraps every response in { success, statusCode, data, ... } via
// the global TransformInterceptor. apiClient.get returns the whole envelope,
// so each method here must unwrap `.data` before handing the payload to
// React Query. Without this the components see `undefined` for every field.
async function list(filters: ListDsarFilters = {}): Promise<ListDsarResult> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.append(k, String(v));
  });
  const qs = params.toString();
  const res = await apiClient.get<{ data: ListDsarResult }>(
    `/dsar${qs ? `?${qs}` : ""}`,
  );
  return res.data;
}

async function findById(id: string): Promise<DsarRequestRow> {
  const res = await apiClient.get<{ data: DsarRequestRow }>(`/dsar/${id}`);
  return res.data;
}

async function create(payload: CreateDsarPayload): Promise<DsarRequestRow> {
  const res = await apiClient.post<{ data: DsarRequestRow }>("/dsar", payload);
  return res.data;
}

async function approve(
  id: string,
  note?: string,
): Promise<DsarRequestRow> {
  const res = await apiClient.post<{ data: DsarRequestRow }>(
    `/dsar/${id}/approve`,
    { note },
  );
  return res.data;
}

async function reject(id: string, reason: string): Promise<DsarRequestRow> {
  const res = await apiClient.post<{ data: DsarRequestRow }>(
    `/dsar/${id}/reject`,
    { reason },
  );
  return res.data;
}

async function download(id: string): Promise<DownloadDsarResult> {
  const res = await apiClient.get<{ data: DownloadDsarResult }>(
    `/dsar/${id}/download`,
  );
  return res.data;
}

export const dsarService = {
  list,
  findById,
  create,
  approve,
  reject,
  download,
};
