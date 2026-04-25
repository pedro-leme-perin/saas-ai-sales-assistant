// =============================================
// DSAR — Constants (S60a)
// =============================================
// LGPD Art. 18 — Data Subject Access Request workflow constants.
// Centralised so RetentionPolicy floor + email TTL + payload caps + legal
// basis citations are consistent across DsarService, DsarExtractService,
// controller, tests.

import { DsarType } from '@prisma/client';

/**
 * Default download artefact TTL in days. Pre-signed URL is regenerated on
 * /download endpoint with the remainder until expiresAt.
 */
export const DSAR_ARTIFACT_TTL_DAYS = 7;

/**
 * Maximum download URL expiry in seconds (R2 hard limit).
 */
export const DSAR_MAX_DOWNLOAD_TTL_SECONDS = 7 * 24 * 3600;

/**
 * Floor for `RetentionPolicy.retentionDays` when resource = DSAR_ARTIFACTS.
 * Below 7d the artefact would expire before the requester can download.
 */
export const DSAR_RETENTION_MIN_DAYS = 7;

/**
 * Hard cap on artefact size (bytes). Beyond this the worker writes a
 * sanitised summary instead of the full payload.
 */
export const DSAR_MAX_ARTIFACT_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Hard cap on rows fetched per resource during EXTRACT_DSAR. Bulkhead.
 */
export const DSAR_MAX_ROWS_PER_RESOURCE = 5_000;

/**
 * Maximum DSAR requests per (company, requesterEmail) within DEDUPE_WINDOW_DAYS
 * to prevent abuse / repeated extraction on the same subject.
 */
export const DSAR_MAX_OPEN_PER_REQUESTER = 3;
export const DSAR_DEDUPE_WINDOW_DAYS = 7;

/**
 * E.164-ish + RFC 5322 subset email regex. Pragmatic — full RFC parser
 * is overkill for input-validation; downstream Resend will reject bad ones.
 */
export const DSAR_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Brazilian CPF format mask — accepts 11 digits with or without dots/dashes.
 * Service layer normalises before persistence.
 */
export const DSAR_CPF_REGEX = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

/**
 * Allowed DSAR types that produce a downloadable artefact (i.e. EXTRACT_DSAR
 * worker generates a JSON or HTML payload). DELETION delegates to LGPD;
 * CORRECTION mutates the contact record and returns a confirmation only.
 * INFO produces a metadata-only artefact (no PII fan-out).
 */
export const DSAR_TYPES_WITH_ARTIFACT: ReadonlySet<DsarType> = new Set([
  DsarType.ACCESS,
  DsarType.PORTABILITY,
  DsarType.INFO,
]);

/**
 * LGPD Art. 18 sub-right citation per DSAR type. Used to stamp the
 * generated artefact with the precise legal basis communicated to the
 * data subject. Centralised so the controller/service/worker/email
 * templates never disagree, and so adding a new sub-right is a single
 * touch-point. Mapping mirrors LGPD Art. 18 verbatim.
 */
export const DSAR_LEGAL_BASIS: Record<DsarType, string> = {
  [DsarType.ACCESS]: 'LGPD Art. 18 II (ACCESS)',
  [DsarType.PORTABILITY]: 'LGPD Art. 18 V (PORTABILITY)',
  [DsarType.CORRECTION]: 'LGPD Art. 18 III (CORRECTION)',
  [DsarType.DELETION]: 'LGPD Art. 18 VI (DELETION)',
  [DsarType.INFO]: 'LGPD Art. 18 VII (INFORMATION)',
};

/**
 * Audit description bodies (kept short — full context lives in AuditLog
 * newValues JSON).
 */
export const DSAR_AUDIT_DESCRIPTIONS = {
  CREATED: 'DSAR request created',
  APPROVED: 'DSAR request approved',
  REJECTED: 'DSAR request rejected',
  COMPLETED: 'DSAR request completed (artefact delivered)',
  DELETION_SCHEDULED: 'DSAR DELETION scheduled (LGPD grace 30d)',
  CONTACT_DELETED: 'DSAR Contact hard-deleted (anonymised related rows)',
  CORRECTION_APPLIED: 'DSAR CORRECTION applied to Contact record',
} as const;
