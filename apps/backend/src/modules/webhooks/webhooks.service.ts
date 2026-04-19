// =============================================
// 🔔 WEBHOOKS SERVICE (Session 46)
// =============================================
// Outbound webhooks (Release It! + System Design Interview)
//  - HMAC SHA-256 signing (timing-safe verifiable)
//  - Retry with exponential backoff (cron)
//  - Circuit breaker per-endpoint (failure isolation)
//  - Bulkhead: bounded batch per tick
//  - Audit log + AuditAction on mutations
// =============================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  AuditAction,
  Prisma,
  WebhookDeliveryStatus,
  WebhookEndpoint,
  WebhookEvent,
} from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CircuitBreaker } from '@common/resilience/circuit-breaker';
import type { AuthenticatedUser } from '@common/decorators';
import { WEBHOOK_EVENT_NAME, type WebhookEmitPayload } from './events/webhook-events';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

const WEBHOOK_DELIVERY_BATCH = Number(process.env.WEBHOOK_DELIVERY_BATCH ?? 100);
const WEBHOOK_MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 6);
const WEBHOOK_HTTP_TIMEOUT_MS = Number(process.env.WEBHOOK_HTTP_TIMEOUT_MS ?? 8_000);
const WEBHOOK_RESPONSE_BODY_MAX = 2_000;
const WEBHOOK_USER_AGENT = 'TheIAdvisor-Webhooks/1.0';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────

  async list(companyId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, companyId },
    });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  async create(companyId: string, actor: AuthenticatedUser, dto: CreateWebhookDto) {
    const secret = this.generateSecret();
    const created = await this.prisma.webhookEndpoint.create({
      data: {
        companyId,
        createdById: actor.id,
        url: dto.url,
        description: dto.description ?? null,
        secret,
        events: dto.events,
      },
    });
    void this.audit(companyId, actor.id, AuditAction.CREATE, created.id, null, {
      url: created.url,
      events: created.events,
    }).catch(() => undefined);
    return created;
  }

  async update(companyId: string, id: string, actor: AuthenticatedUser, dto: UpdateWebhookDto) {
    const existing = await this.findById(companyId, id);
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    void this.audit(
      companyId,
      actor.id,
      AuditAction.UPDATE,
      id,
      { url: existing.url, events: existing.events, isActive: existing.isActive },
      { url: updated.url, events: updated.events, isActive: updated.isActive },
    ).catch(() => undefined);
    return updated;
  }

  async remove(companyId: string, id: string, actor: AuthenticatedUser) {
    await this.findById(companyId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    void this.audit(companyId, actor.id, AuditAction.DELETE, id, null, null).catch(() => undefined);
    return { ok: true };
  }

  async rotateSecret(companyId: string, id: string, actor: AuthenticatedUser) {
    await this.findById(companyId, id);
    const newSecret = this.generateSecret();
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { secret: newSecret },
      select: { id: true, secret: true, updatedAt: true },
    });
    void this.audit(companyId, actor.id, AuditAction.UPDATE, id, null, {
      rotated: true,
    }).catch(() => undefined);
    return updated;
  }

  async listDeliveries(companyId: string, endpointId: string | null, limit = 50, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.prisma.webhookDelivery.findMany({
      where: { companyId, ...(endpointId ? { endpointId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  // ─────────────────────────────────────────────
  // Emit (called by domain services via EventEmitter)
  // ─────────────────────────────────────────────

  @OnEvent(WEBHOOK_EVENT_NAME, { async: true, promisify: false })
  async onEmit(payload: WebhookEmitPayload): Promise<void> {
    try {
      await this.emit(payload);
    } catch (err) {
      // Never bubble up: webhooks are best-effort fan-out.
      this.logger.error(
        `Webhook emit failed for ${payload.event}/${payload.companyId}: ${(err as Error).message}`,
      );
    }
  }

  async emit(payload: WebhookEmitPayload): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        companyId: payload.companyId,
        isActive: true,
        events: { has: payload.event },
      },
    });
    if (endpoints.length === 0) return;

    const now = new Date();
    await this.prisma.webhookDelivery.createMany({
      data: endpoints.map((ep) => ({
        endpointId: ep.id,
        companyId: payload.companyId,
        event: payload.event,
        payload: this.wrapPayload(payload.event, payload.data) as Prisma.InputJsonValue,
        status: WebhookDeliveryStatus.PENDING,
        nextAttemptAt: now,
      })),
    });
  }

  // ─────────────────────────────────────────────
  // Retry loop (cron)
  // ─────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE, { name: 'webhook-retry-loop' })
  async processPending(): Promise<void> {
    const pending = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
        attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
      },
      include: { endpoint: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: WEBHOOK_DELIVERY_BATCH,
    });
    if (pending.length === 0) return;

    this.logger.log(`📤 Dispatching ${pending.length} pending webhook deliveries`);
    // Error-isolated per-delivery
    for (const delivery of pending) {
      try {
        await this.dispatch(delivery);
      } catch (err) {
        this.logger.error(
          `Dispatch loop error for delivery ${delivery.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async dispatch(
    delivery: Awaited<ReturnType<PrismaService['webhookDelivery']['findMany']>>[number] & {
      endpoint: WebhookEndpoint;
    },
  ): Promise<void> {
    const endpoint = delivery.endpoint;
    if (!endpoint || !endpoint.isActive) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.DEAD_LETTER,
          errorMessage: 'endpoint inactive or missing',
        },
      });
      return;
    }

    const breaker = this.getBreaker(endpoint.id);
    const body = JSON.stringify(delivery.payload);
    const signature = this.sign(endpoint.secret, body);
    const attemptNo = delivery.attempts + 1;

    try {
      const response = await breaker.execute(() =>
        this.httpPost(endpoint.url, body, {
          'Content-Type': 'application/json',
          'User-Agent': WEBHOOK_USER_AGENT,
          'X-TheIAdvisor-Event': delivery.event,
          'X-TheIAdvisor-Delivery': delivery.id,
          'X-TheIAdvisor-Signature': signature,
          'X-TheIAdvisor-Timestamp': String(Math.floor(Date.now() / 1000)),
        }),
      );

      const ok = response.status >= 200 && response.status < 300;
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: ok ? WebhookDeliveryStatus.SUCCEEDED : WebhookDeliveryStatus.FAILED,
            attempts: attemptNo,
            lastAttemptAt: new Date(),
            responseStatus: response.status,
            responseBody: response.body.slice(0, WEBHOOK_RESPONSE_BODY_MAX),
            deliveredAt: ok ? new Date() : null,
            nextAttemptAt: ok ? null : this.nextAttemptAt(attemptNo),
            errorMessage: ok ? null : `HTTP ${response.status}`,
          },
        }),
        this.prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: ok
            ? { lastSuccessAt: new Date(), failureCount: 0 }
            : { lastFailureAt: new Date(), failureCount: { increment: 1 } },
        }),
      ]);

      if (!ok && attemptNo >= WEBHOOK_MAX_ATTEMPTS) {
        await this.markDeadLetter(delivery.id);
      }
    } catch (err) {
      const message = (err as Error).message || 'unknown';
      await this.prisma.$transaction([
        this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: WebhookDeliveryStatus.FAILED,
            attempts: attemptNo,
            lastAttemptAt: new Date(),
            errorMessage: message.slice(0, WEBHOOK_RESPONSE_BODY_MAX),
            nextAttemptAt: this.nextAttemptAt(attemptNo),
          },
        }),
        this.prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { lastFailureAt: new Date(), failureCount: { increment: 1 } },
        }),
      ]);
      if (attemptNo >= WEBHOOK_MAX_ATTEMPTS) {
        await this.markDeadLetter(delivery.id);
      }
    }
  }

  private async markDeadLetter(deliveryId: string) {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: WebhookDeliveryStatus.DEAD_LETTER, nextAttemptAt: null },
    });
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  /**
   * HTTP POST via global fetch (Node 20+). Abstracted so tests can spy.
   * Never throws HTTP 4xx/5xx — callers read response.status.
   */
  protected async httpPost(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        body,
        headers,
        signal: controller.signal,
      });
      const text = await res.text().catch(() => '');
      return { status: res.status, body: text };
    } finally {
      clearTimeout(timer);
    }
  }

  protected sign(secret: string, body: string): string {
    return (
      't=' +
      Math.floor(Date.now() / 1000) +
      ',v1=' +
      createHmac('sha256', secret).update(body).digest('hex')
    );
  }

  /**
   * Timing-safe verifier — exposed so customers can reuse in helpers/docs.
   */
  static verifySignature(
    secret: string,
    body: string,
    header: string,
    toleranceSec = 300,
  ): boolean {
    try {
      const parts = Object.fromEntries(
        header.split(',').map((kv) => kv.split('=', 2) as [string, string]),
      );
      const t = Number(parts.t);
      const v1 = parts.v1;
      if (!Number.isFinite(t) || !v1) return false;
      if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return false;
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(v1, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private generateSecret(): string {
    return 'whsec_' + randomBytes(24).toString('hex');
  }

  private nextAttemptAt(attemptNumber: number): Date {
    // Exponential backoff: 1m, 2m, 5m, 15m, 60m, 240m (cap)
    const schedule = [60, 120, 300, 900, 3600, 14400];
    const seconds = schedule[Math.min(attemptNumber - 1, schedule.length - 1)] ?? 14400;
    return new Date(Date.now() + seconds * 1000);
  }

  private wrapPayload(event: WebhookEvent, data: Record<string, unknown>) {
    return {
      id: `evt_${randomBytes(12).toString('hex')}`,
      event,
      createdAt: new Date().toISOString(),
      data,
    };
  }

  private getBreaker(endpointId: string): CircuitBreaker {
    let cb = this.breakers.get(endpointId);
    if (!cb) {
      cb = new CircuitBreaker({
        name: `Webhook-${endpointId}`,
        callTimeoutMs: WEBHOOK_HTTP_TIMEOUT_MS + 2_000,
        failureThreshold: 5,
        resetTimeoutMs: 60_000,
      });
      this.breakers.set(endpointId, cb);
    }
    return cb;
  }

  private async audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    oldValues: Prisma.InputJsonValue | null,
    newValues: Prisma.InputJsonValue | null,
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action,
        resource: 'WEBHOOK_ENDPOINT',
        resourceId,
        oldValues: oldValues ?? Prisma.JsonNull,
        newValues: newValues ?? Prisma.JsonNull,
      },
    });
  }
}
