// =============================================
// TYPES — Re-export from @saas/shared (single source of truth)
// =============================================

export {
  // Enums
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
  // Entities
  type User,
  type Company,
  type Call,
  type WhatsAppChat,
  type WhatsAppMessage,
  type AISuggestion,
  type Notification,
  // API types
  type ApiResponse,
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type PaginationMeta,
  type PaginatedResponse,
  // Analytics
  type CompanyStats,
  type CompanyUsage,
  type CallStats,
  type CompanyLimits,
  type PlanDetails,
  // WebSocket
  type WSAISuggestion,
  type WSCallStatus,
  type WSNewMessage,
  type WSNotification,
} from '@saas/shared';
