// =============================================
// ENTITY INTERFACES — Contratos de domínio compartilhados
// =============================================

import {
  Plan,
  UserRole,
  CallStatus,
  CallDirection,
  ChatStatus,
  ChatPriority,
  MessageDirection,
  MessageType,
  SentimentLabel,
  NotificationType,
  AISuggestionType,
} from './enums';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  companyId: string;
  company?: Company;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  website?: string;
  industry?: string;
  logo?: string;
  maxUsers: number;
  maxCallsPerMonth: number;
  maxChatsPerMonth: number;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    calls: number;
    whatsappChats: number;
  };
}

export interface Call {
  id: string;
  companyId: string;
  userId: string;
  user?: User;
  phoneNumber: string;
  contactName?: string;
  direction: CallDirection;
  status: CallStatus;
  duration: number;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  summary?: string;
  sentiment?: number;
  sentimentLabel?: SentimentLabel;
  keywords?: string[];
  notes?: string;
  recordingUrl?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppChat {
  id: string;
  companyId: string;
  userId: string;
  user?: User;
  customerPhone: string;
  customerName?: string;
  status: ChatStatus;
  priority: ChatPriority;
  tags?: string[];
  unreadCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  metadata?: Record<string, unknown>;
  messages?: WhatsAppMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  content: string;
  type: MessageType;
  direction: MessageDirection;
  status: string;
  mediaUrl?: string;
  aiSuggestionUsed?: boolean;
  createdAt: string;
}

export interface AISuggestion {
  id?: string;
  suggestion: string;
  confidence: number;
  type: AISuggestionType;
  context?: string;
  timestamp?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
