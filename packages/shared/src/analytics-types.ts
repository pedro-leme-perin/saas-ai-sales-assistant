// =============================================
// ANALYTICS & STATS TYPES
// =============================================

import { Plan } from './enums';

export interface CompanyStats {
  users: { total: number; active: number };
  calls: { total: number; thisMonth: number; thisWeek: number };
  chats: { active: number };
  messages: { total: number };
}

export interface CompanyUsage {
  users: { used: number; limit: number; percentage: number };
  calls: { used: number; limit: number; percentage: number };
  chats: { used: number; limit: number; percentage: number };
  plan: Plan;
}

export interface CallStats {
  total: number;
  byStatus: Record<string, number>;
  byDirection: Record<string, number>;
  avgDuration: number;
  totalDuration: number;
}

export interface CompanyLimits {
  maxUsers: number;
  maxCallsPerMonth: number;
  maxChatsPerMonth: number;
}

export interface PlanDetails {
  plan: Plan;
  name: string;
  price: number;
  features: string[];
  limits: {
    users: number;
    callsPerMonth: number;
    chatsPerMonth: number;
  };
}
