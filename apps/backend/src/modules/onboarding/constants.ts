// =============================================
// 🚀 ONBOARDING — Constants & Step Catalog
// =============================================
// Session 42: Onboarding guiado pós-signup
// Clean Architecture: Domain layer (no external deps)
// =============================================

export const ONBOARDING_STEPS = [
  'COMPLETE_PROFILE',
  'COMPANY_DETAILS',
  'INVITE_TEAM',
  'CONNECT_CHANNEL',
  'FIRST_INTERACTION',
  'EXPLORE_ANALYTICS',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  order: number;
  actionUrl: string;
  /** Whether this step is auto-detectable from DB state */
  autoDetectable: boolean;
  /** Estimated minutes to complete (UX hint) */
  estimatedMinutes: number;
}

export const STEP_CATALOG: readonly OnboardingStepDefinition[] = [
  {
    id: 'COMPLETE_PROFILE',
    order: 1,
    actionUrl: '/dashboard/settings?tab=profile',
    autoDetectable: true,
    estimatedMinutes: 2,
  },
  {
    id: 'COMPANY_DETAILS',
    order: 2,
    actionUrl: '/dashboard/settings?tab=company',
    autoDetectable: true,
    estimatedMinutes: 3,
  },
  {
    id: 'INVITE_TEAM',
    order: 3,
    actionUrl: '/dashboard/team',
    autoDetectable: true,
    estimatedMinutes: 2,
  },
  {
    id: 'CONNECT_CHANNEL',
    order: 4,
    actionUrl: '/dashboard/settings?tab=integrations',
    autoDetectable: true,
    estimatedMinutes: 10,
  },
  {
    id: 'FIRST_INTERACTION',
    order: 5,
    actionUrl: '/dashboard/calls',
    autoDetectable: true,
    estimatedMinutes: 5,
  },
  {
    id: 'EXPLORE_ANALYTICS',
    order: 6,
    actionUrl: '/dashboard/analytics',
    autoDetectable: false,
    estimatedMinutes: 2,
  },
] as const;

export interface OnboardingProgressState {
  stepsCompleted: OnboardingStepId[];
  stepsSkipped: OnboardingStepId[];
  dismissedAt: string | null;
  completedAt: string | null;
  startedAt: string;
  lastUpdatedAt: string;
}

export const EMPTY_ONBOARDING_PROGRESS = (): OnboardingProgressState => {
  const now = new Date().toISOString();
  return {
    stepsCompleted: [],
    stepsSkipped: [],
    dismissedAt: null,
    completedAt: null,
    startedAt: now,
    lastUpdatedAt: now,
  };
};

/**
 * Compute progress percentage (0-100).
 * Skipped steps count toward progress (user chose to dismiss).
 */
export function computeProgressPercent(state: OnboardingProgressState): number {
  const completed = new Set([...state.stepsCompleted, ...state.stepsSkipped]);
  return Math.round((completed.size / ONBOARDING_STEPS.length) * 100);
}

export function isOnboardingComplete(state: OnboardingProgressState): boolean {
  const completed = new Set([...state.stepsCompleted, ...state.stepsSkipped]);
  return ONBOARDING_STEPS.every((step) => completed.has(step));
}
