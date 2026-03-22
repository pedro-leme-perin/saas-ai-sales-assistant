// =============================================
// WEBSOCKET EVENT TYPES
// =============================================

import { CallStatus } from './enums';
import { AISuggestion, WhatsAppMessage, Notification } from './entities';

export interface WSAISuggestion {
  callId?: string;
  chatId?: string;
  suggestion: AISuggestion;
  timestamp: string;
}

export interface WSCallStatus {
  callId: string;
  status: CallStatus;
  duration?: number;
  timestamp: string;
}

export interface WSNewMessage {
  chatId: string;
  message: WhatsAppMessage;
  timestamp: string;
}

export interface WSNotification {
  notification: Notification;
  timestamp: string;
}
