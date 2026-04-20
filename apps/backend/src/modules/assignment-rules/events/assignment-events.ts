// =============================================
// 🎯 Assignment events (Session 54 — Feature A2)
// =============================================
// Fired by WhatsappService when a NEW chat is created.
// AssignmentRulesService listens and auto-assigns.

export const CHAT_CREATED_EVENT = 'chat.created' as const;

export interface ChatCreatedPayload {
  companyId: string;
  chatId: string;
  customerPhone: string;
  customerName?: string | null;
  priority?: string; // ChatPriority — keep loose to avoid Prisma import cycle
  tags?: string[]; // optional inbound tags (future-proof)
}
