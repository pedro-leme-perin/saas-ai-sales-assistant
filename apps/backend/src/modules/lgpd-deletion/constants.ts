// =============================================
// 🗑️  LGPD DELETION — Constants
// =============================================

export const LGPD_DELETION_GRACE_DAYS = 30;

/** Maximum users processed per cron tick (Release It! bulkhead). */
export const LGPD_DELETION_BATCH_SIZE = 50;

/**
 * Fields stored in AuditLog.newValues after hard deletion.
 * Keeps a minimal, anonymised trail — names/emails intentionally omitted.
 */
export interface LgpdDeletionAuditMetadata {
  scheduledAt: string;
  executedAt: string;
  cascadeCounts: {
    calls: number;
    whatsappChats: number;
    aiSuggestions: number;
    notifications: number;
    auditLogsRetained: number;
  };
}
