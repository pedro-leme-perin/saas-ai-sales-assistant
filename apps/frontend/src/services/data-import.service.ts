// =============================================
// 📥 DATA IMPORT SERVICE (Session 54)
// =============================================

import apiClient from "@/lib/api-client";

export interface EnqueueImportResult {
  jobId: string;
  status: string;
}

export const dataImportService = {
  enqueueContacts: (csvContent: string) =>
    apiClient.post<EnqueueImportResult>(`/data-import/contacts`, { csvContent }),
};
