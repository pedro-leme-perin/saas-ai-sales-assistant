// =============================================
// 📦 DOMAIN TYPES
// =============================================

import { UserRole, Plan, CallStatus, ChatStatus } from '@prisma/client';

export interface TenantContext {
  companyId: string;
  userId: string;
  role: UserRole;
}

export interface CompanyLimits {
  maxUsers: number;
  maxCallsPerMonth: number;
  maxChatsPerMonth: number;
}

export interface UsageSummary {
  users: { used: number; limit: number; percentage: number };
  calls: { used: number; limit: number; percentage: number };
  chats: { used: number; limit: number; percentage: number };
  plan: Plan;
}

export interface CallSummary {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  status: CallStatus;
  duration: number;
  sentiment: number | null;
  createdAt: Date;
}

export interface ChatSummary {
  id: string;
  customerPhone: string;
  customerName: string | null;
  status: ChatStatus;
  unreadCount: number;
  lastMessageAt: Date | null;
}
