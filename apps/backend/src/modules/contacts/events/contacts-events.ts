// =============================================
// 📄 CONTACTS — internal event bus (Session 50)
// =============================================

export const CONTACT_TOUCH_EVENT = 'contacts.touch';

export type ContactTouchChannel = 'CALL' | 'CHAT';

export interface ContactTouchPayload {
  companyId: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  channel: ContactTouchChannel;
  // Optional: caller can associate a source record for timeline correlation.
  callId?: string;
  chatId?: string;
}
