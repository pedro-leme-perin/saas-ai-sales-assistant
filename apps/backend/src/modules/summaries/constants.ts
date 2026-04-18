// =============================================
// 📄 SUMMARIES — Constants & Types
// =============================================
// Session 44: On-demand conversation summaries (calls / WhatsApp chats).
// Cache-only in Redis (24h TTL). Source-of-truth = Call.transcript or
// WhatsappMessage rows. No new DB table.
// =============================================

/** Redis TTL for cached summaries (seconds). */
export const SUMMARY_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h

/** Max transcript chars passed to the LLM (keeps prompt under ~8k tokens). */
export const SUMMARY_MAX_TRANSCRIPT_CHARS = 20_000;

/** Max characters per chat message when assembling transcript. */
export const SUMMARY_MAX_MESSAGE_CHARS = 800;

/** Max messages included in chat summary prompt (most recent N). */
export const SUMMARY_MAX_MESSAGES = 80;

/** LLM call timeout — longer than suggestion SLO because summary is async. */
export const SUMMARY_LLM_TIMEOUT_MS = 20_000;

export type SentimentPoint = 'positive' | 'neutral' | 'negative';

export interface SummarySentimentTick {
  /** Fractional position in the conversation (0.0 = start, 1.0 = end). */
  position: number;
  sentiment: SentimentPoint;
  /** Optional short excerpt that drove the sentiment call. */
  note?: string;
}

export interface ConversationSummary {
  /** 3-6 bullet points — what happened, agreed next steps, pain points. */
  keyPoints: string[];
  /** 3-5 sentiment samples across the conversation timeline. */
  sentimentTimeline: SummarySentimentTick[];
  /** Single recommended next action for the rep. */
  nextBestAction: string;
  /** ISO-8601 of generation time (server clock). */
  generatedAt: string;
  /** Indicates cache origin (fresh | cached). */
  cached: boolean;
  /** Provider used (openai | fallback). */
  provider: string;
}

export interface SummarySource {
  kind: 'call' | 'chat';
  id: string;
  /** companyId for tenant isolation. */
  companyId: string;
  /** Human label for logging. */
  label: string;
  /** Transcript text to summarise. */
  transcript: string;
  /** Short content hash — invalidates cache when conversation changes. */
  contentHash: string;
}

/** Redis key for a summary cache entry. */
export function summaryCacheKey(kind: 'call' | 'chat', id: string, hash: string): string {
  return `summary:${kind}:${id}:${hash}`;
}
