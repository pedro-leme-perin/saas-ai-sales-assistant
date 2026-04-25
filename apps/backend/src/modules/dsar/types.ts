// =============================================
// DSAR — Internal types (S60a)
// =============================================
// Strongly-typed contracts for service <-> worker <-> controller boundaries.
// NO Prisma types leak into Domain — these are pure TS interfaces.

import { DsarStatus, DsarType } from '@prisma/client';

/**
 * Payload passed to the EXTRACT_DSAR background job. Worker reads this
 * from `BackgroundJob.payload` (Json) — keep it serialisable + small.
 */
export interface ExtractDsarPayload extends Record<string, unknown> {
  dsarRequestId: string;
  type: DsarType;
}

/**
 * Result emitted by the EXTRACT_DSAR worker into `BackgroundJob.result`.
 * `dsarRequestId` echoed for downstream cron/audit observability.
 */
export interface ExtractDsarResult extends Record<string, unknown> {
  dsarRequestId: string;
  status: 'COMPLETED' | 'FAILED' | 'NOOP';
  artifactKey?: string;
  artifactBytes?: number;
  expiresAt?: string;
  error?: string;
}

/**
 * Allowed status transitions enforced by `assertTransition()` in DsarService.
 * Any change here MUST be paired with a unit test in dsar.service.spec.ts.
 */
export const DSAR_STATE_MACHINE: Record<DsarStatus, ReadonlySet<DsarStatus>> = {
  PENDING: new Set([DsarStatus.APPROVED, DsarStatus.REJECTED]),
  APPROVED: new Set([DsarStatus.PROCESSING, DsarStatus.FAILED]),
  PROCESSING: new Set([DsarStatus.COMPLETED, DsarStatus.FAILED]),
  COMPLETED: new Set([DsarStatus.EXPIRED]),
  REJECTED: new Set([]),
  EXPIRED: new Set([]),
  FAILED: new Set([]),
};

/**
 * Minimal correction payload schema. Constrained to Contact-side fields
 * because LGPD CORRECTION (Art. 18, III) targets data subject records,
 * not internal company entities (Calls/Chats keep historical accuracy).
 *
 * Keys MUST match the runtime allow-list in DsarExtractService.applyCorrection.
 */
export interface CorrectionPayload {
  /** New name; null clears it (subject opt-out of personalisation). */
  name?: string | null;
  /** New email — must be a valid address. */
  email?: string | null;
  /** New phone — E.164 normalisation handled by service. */
  phone?: string | null;
  /** New IANA timezone. */
  timezone?: string | null;
  /** Reason for the correction (audit trail). */
  reason?: string;
}

/**
 * Aggregated artefact shape produced by extracts (ACCESS/PORTABILITY/INFO).
 * Persisted to R2 as JSON (UTF-8). `format` differentiates downstream
 * frontend rendering should we ever ship HTML reports.
 *
 * `legalBasis` is the human-readable LGPD Art. 18 sub-right citation
 * stamped on the artefact for the requester's awareness — derived from
 * `DSAR_LEGAL_BASIS[type]` in constants.ts. Typed as `string` (not a
 * literal union) because the mapping is data-driven and may grow as
 * the LGPD evolves; runtime values are still constrained by that map.
 */
export interface DsarArtifact {
  format: 'json';
  generatedAt: string; // ISO
  requestId: string;
  type: DsarType;
  requester: {
    email: string;
    name?: string | null;
    cpf?: string | null;
  };
  match: {
    userId?: string;
    contactId?: string;
  };
  data: {
    profile?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    calls?: Array<Record<string, unknown>>;
    chats?: Array<Record<string, unknown>>;
    aiSuggestions?: Array<Record<string, unknown>>;
    notifications?: Array<Record<string, unknown>>;
    csatResponses?: Array<Record<string, unknown>>;
    auditLogs?: Array<Record<string, unknown>>;
  };
  /** Counts before truncation — useful when MAX_ROWS_PER_RESOURCE was hit. */
  totals: {
    calls: number;
    chats: number;
    aiSuggestions: number;
    notifications: number;
    csatResponses: number;
    auditLogs: number;
    truncated: boolean;
  };
  /** LGPD article reference (see constants.DSAR_LEGAL_BASIS). */
  legalBasis: string;
}
