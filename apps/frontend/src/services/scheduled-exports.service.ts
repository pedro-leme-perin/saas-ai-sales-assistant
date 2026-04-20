// =============================================
// 📤 SCHEDULED EXPORTS SERVICE (Session 51)
// =============================================

import apiClient from "@/lib/api-client";

export type ScheduledExportResource =
  | "ANALYTICS_OVERVIEW"
  | "CONTACTS"
  | "AUDIT_LOGS"
  | "CALLS"
  | "WHATSAPP_CHATS"
  | "CSAT_RESPONSES";

export type ScheduledExportFormat = "CSV" | "JSON";
export type ScheduledExportRunStatus = "OK" | "FAILED";

export interface ScheduledExport {
  id: string;
  companyId: string;
  createdById: string | null;
  name: string;
  resource: ScheduledExportResource;
  format: ScheduledExportFormat;
  cronExpression: string;
  timezone: string;
  recipients: string[];
  filters: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: ScheduledExportRunStatus | null;
  lastError: string | null;
  lastRowCount: number | null;
  runCount: number;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledExportInput {
  name: string;
  resource: ScheduledExportResource;
  format?: ScheduledExportFormat;
  cronExpression: string;
  timezone?: string;
  recipients: string[];
  filters?: Record<string, unknown>;
  isActive?: boolean;
}

export type UpdateScheduledExportInput = Partial<
  Omit<CreateScheduledExportInput, "resource">
>;

export const scheduledExportsService = {
  list: async () => {
    const res = await apiClient.get<{ data: ScheduledExport[] }>(`/scheduled-exports`);
    return res.data;
  },
  findById: (id: string) => apiClient.get<ScheduledExport>(`/scheduled-exports/${id}`),
  create: (input: CreateScheduledExportInput) =>
    apiClient.post<ScheduledExport>(`/scheduled-exports`, input),
  update: (id: string, input: UpdateScheduledExportInput) =>
    apiClient.patch<ScheduledExport>(`/scheduled-exports/${id}`, input),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/scheduled-exports/${id}`),
  runNow: (id: string) =>
    apiClient.post<ScheduledExport>(`/scheduled-exports/${id}/run-now`, {}),
};
