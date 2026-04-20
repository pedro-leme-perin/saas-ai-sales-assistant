// =============================================
// 📄 CSAT EVENTS (Session 50)
// =============================================
// Event-based bridge so CallsModule and WhatsappModule can request CSAT
// scheduling without importing CsatModule (which would create circular
// imports because CsatModule already imports WhatsappModule).

import { CsatTrigger } from '@prisma/client';

export const CSAT_SCHEDULE_EVENT = 'csat.schedule';

export interface CsatScheduleEventPayload {
  companyId: string;
  trigger: CsatTrigger;
  callId?: string;
  chatId?: string;
  contactId?: string | null;
}
