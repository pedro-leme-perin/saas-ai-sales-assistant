// src/modules/auth/webhooks/clerk-webhook.controller.ts

import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Webhook } from 'svix';
import { UsersService } from '../../users/users.service';
import { Public } from '../decorators/public.decorator';
import { WebhookIdempotencyService } from '../../../common/resilience/webhook-idempotency.service';
import {
  ClerkWebhookEvent,
  ClerkUserData,
  ClerkWebhookEventType,
} from '../interfaces/clerk.interfaces';

@ApiTags('webhooks')
@SkipThrottle() // Clerk webhooks are server-to-server, must not be rate-limited
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Clerk user events webhook (internal)',
    description:
      'Receives Clerk webhook events for user lifecycle management (user.created, user.updated, user.deleted). ' +
      'Verifies Svix signature before processing. Idempotent via Redis deduplication on svix-id. ' +
      'Server-to-server only -- not intended for direct client consumption.',
  })
  @ApiHeader({
    name: 'svix-id',
    required: true,
    description: 'Unique webhook delivery ID from Svix (used for idempotency)',
  })
  @ApiHeader({
    name: 'svix-timestamp',
    required: true,
    description: 'Unix timestamp of webhook delivery',
  })
  @ApiHeader({
    name: 'svix-signature',
    required: true,
    description: 'HMAC signature for webhook payload verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received and processed (or deduplicated)',
    schema: {
      type: 'object',
      properties: { received: { type: 'boolean', example: true } },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing svix headers or invalid webhook signature',
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log('Received Clerk webhook');

    // 1. Validar headers
    if (!svixId || !svixTimestamp || !svixSignature) {
      this.logger.warn('Missing svix headers');
      throw new BadRequestException('Missing webhook signature headers');
    }

    // 2. Verificar assinatura
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.error('CLERK_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: ClerkWebhookEvent;

    try {
      const wh = new Webhook(webhookSecret);
      const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;

      this.logger.debug(`Webhook verified: ${event.type}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook verification failed: ${message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // 3. Idempotency check — svix-id is unique per delivery (Release It! — Idempotent Receivers)
    const { isDuplicate, correlationId } = await this.webhookIdempotency.checkAndMark(
      'clerk',
      svixId,
    );
    if (isDuplicate) {
      this.logger.warn(`Skipping duplicate Clerk event [${correlationId}] type=${event.type}`);
      return { received: true };
    }

    // 4. Processar evento
    this.logger.log(`Processing [${correlationId}]: ${event.type}`);
    await this.processEvent(event.type, event.data);

    return { received: true };
  }

  private async processEvent(type: ClerkWebhookEventType, data: ClerkUserData): Promise<void> {
    this.logger.log(`Processing event: ${type} for user ${data.id}`);

    try {
      switch (type) {
        case 'user.created':
          await this.handleUserCreated(data);
          break;

        case 'user.updated':
          await this.handleUserUpdated(data);
          break;

        case 'user.deleted':
          await this.handleUserDeleted(data);
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${type}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error processing ${type}: ${message}`, stack);
    }
  }

  private async handleUserCreated(data: ClerkUserData): Promise<void> {
    this.logger.log(`Handling user.created: ${data.id}`);
    const user = await this.usersService.createFromWebhook(data);
    this.logger.log(`User created from webhook: ${user.id}`);
  }

  private async handleUserUpdated(data: ClerkUserData): Promise<void> {
    this.logger.log(`Handling user.updated: ${data.id}`);
    const user = await this.usersService.updateFromWebhook(data);
    if (user) {
      this.logger.log(`User updated from webhook: ${user.id}`);
    }
  }

  private async handleUserDeleted(data: ClerkUserData): Promise<void> {
    this.logger.log(`Handling user.deleted: ${data.id}`);
    await this.usersService.softDeleteByClerkId(data.id);
    this.logger.log(`User soft-deleted from webhook: ${data.id}`);
  }
}
