// =============================================
// 📄 COACHING REPORTS — CONSTANTS & TYPES
// =============================================
// Session 44: Weekly AI coaching digests per vendor.
// =============================================

// Hard cap per cron tick (Release It! bulkhead) — one report per user per week.
export const COACHING_BATCH_SIZE = 50;

// LLM call ceiling per report generation.
export const COACHING_LLM_TIMEOUT_MS = 20_000;

// Minimum activity required to generate a meaningful report; below this we skip
// the LLM and persist a "no-op" stub so we never spam under-active vendors.
export const COACHING_MIN_ACTIVITY_EVENTS = 3;

export interface CoachingMetrics {
  calls: {
    total: number;
    completed: number;
    missed: number;
    avgDurationSeconds: number;
    conversionRate: number; // completed / total, 0-1
  };
  whatsapp: {
    chats: number;
    messagesSent: number;
    responseRateP50Minutes: number; // median outbound latency
  };
  ai: {
    suggestionsShown: number;
    suggestionsUsed: number;
    adoptionRate: number; // used / shown, 0-1
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface CoachingLLMOutput {
  insights: string[]; // 3-5 observations
  recommendations: string[]; // 2-4 actionable tips
}

export interface WeekRange {
  start: Date; // inclusive (Monday 00:00 UTC)
  end: Date; // exclusive (next Monday 00:00 UTC)
}

/**
 * Compute the **previous** ISO week boundary in UTC — we report on the week
 * that just ended, not the current one. Runs at Monday 10:00 UTC (≈ 07:00 BRT).
 */
export function previousWeekRange(now: Date = new Date()): WeekRange {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sunday
  // Offset back to Monday (ISO: Monday=1)
  const offsetToMonday = (dow + 6) % 7;
  const thisMonday = new Date(d);
  thisMonday.setUTCDate(d.getUTCDate() - offsetToMonday);
  const start = new Date(thisMonday);
  start.setUTCDate(thisMonday.getUTCDate() - 7);
  const end = new Date(thisMonday);
  return { start, end };
}
