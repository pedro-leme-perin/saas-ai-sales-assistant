// =============================================
// 💸 PAYMENT RECOVERY — Constants
// =============================================
// Session 42: Dunning + Billing recovery.
// Release It!: Stability Patterns — graceful degradation of revenue failure.
// =============================================

import { Plan } from '@prisma/client';

export type DunningStage = 'D1' | 'D3' | 'D7' | 'SUSPENDED';

export const DUNNING_SCHEDULE: Record<
  Exclude<DunningStage, 'SUSPENDED'>,
  { offsetHours: number; nextStage: DunningStage }
> = {
  D1: { offsetHours: 24, nextStage: 'D3' },
  D3: { offsetHours: 48, nextStage: 'D7' }, // 24h after D1 + 48h = ~72h total
  D7: { offsetHours: 96, nextStage: 'SUSPENDED' }, // reaches ~7d total
};

/**
 * Grace period (days) per plan. After grace period expires and payment
 * remains failed, subscription is suspended (access revoked).
 */
export const GRACE_PERIOD_DAYS: Record<Plan, number> = {
  STARTER: 3,
  PROFESSIONAL: 5,
  ENTERPRISE: 14,
};

export function computeNextDunningAt(stage: DunningStage, from: Date = new Date()): Date | null {
  if (stage === 'SUSPENDED') return null;
  const schedule = DUNNING_SCHEDULE[stage];
  return new Date(from.getTime() + schedule.offsetHours * 60 * 60 * 1000);
}

export function graceDeadline(plan: Plan, failedAt: Date): Date {
  const days = GRACE_PERIOD_DAYS[plan] ?? GRACE_PERIOD_DAYS.STARTER;
  return new Date(failedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export const EXIT_SURVEY_REASONS = [
  'too_expensive',
  'missing_feature',
  'switched_competitor',
  'no_longer_needed',
  'technical_issues',
  'poor_support',
  'other',
] as const;

export type ExitSurveyReason = (typeof EXIT_SURVEY_REASONS)[number];
