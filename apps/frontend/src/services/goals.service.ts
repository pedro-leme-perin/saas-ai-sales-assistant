import apiClient from "@/lib/api-client";

export type GoalMetric =
  | "CALLS_TOTAL"
  | "CALLS_COMPLETED"
  | "CONVERSION_RATE"
  | "AI_ADOPTION_RATE"
  | "WHATSAPP_MESSAGES";

export type GoalPeriodType = "WEEKLY" | "MONTHLY";
export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "VENDOR";

export interface GoalProgress {
  id: string;
  metric: GoalMetric;
  target: number;
  current: number;
  progressPct: number;
  isCompanyWide: boolean;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  metrics: {
    callsTotal: number;
    callsCompleted: number;
    conversionRate: number;
    aiSuggestionsShown: number;
    aiSuggestionsUsed: number;
    aiAdoptionRate: number;
    whatsappMessagesSent: number;
  };
  goals: GoalProgress[];
  compositeScore: number;
}

export interface LeaderboardResponse {
  period: { type: GoalPeriodType; start: string; end: string };
  rows: LeaderboardRow[];
}

export interface TeamGoal {
  id: string;
  companyId: string;
  userId: string | null;
  metric: GoalMetric;
  target: number;
  periodType: GoalPeriodType;
  periodStart: string;
  periodEnd: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string };
}

export interface CreateGoalPayload {
  metric: GoalMetric;
  periodType: GoalPeriodType;
  target: number;
  userId?: string;
  periodAnchor?: string;
}

export const goalsService = {
  leaderboard: (period: GoalPeriodType = "WEEKLY") =>
    apiClient.get<LeaderboardResponse>(`/goals/leaderboard?period=${period}`),

  listCurrent: (period: GoalPeriodType = "WEEKLY") =>
    apiClient.get<{ data: TeamGoal[] }>(`/goals/current?period=${period}`),

  create: (payload: CreateGoalPayload) =>
    apiClient.post<TeamGoal>("/goals", payload),

  update: (id: string, target: number) =>
    apiClient.patch<TeamGoal>(`/goals/${id}`, { target }),

  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/goals/${id}`),
};
