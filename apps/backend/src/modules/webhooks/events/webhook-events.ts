import { WebhookEvent } from '@prisma/client';

/**
 * Internal event-bus event names (NestJS EventEmitter).
 * Keep these in sync with WebhookEvent enum.
 */
export const WEBHOOK_EVENT_NAME = 'webhooks.emit';

export interface WebhookEmitPayload {
  companyId: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
}
