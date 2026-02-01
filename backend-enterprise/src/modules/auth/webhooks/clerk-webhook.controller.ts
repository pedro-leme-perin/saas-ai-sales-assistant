// src/modules/auth/webhooks/clerk-webhook.controller.ts

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';
import { UsersService } from '../../users/users.service';
import { Public } from '../decorators/public.decorator';
import { 
  ClerkWebhookEvent, 
  ClerkUserData,
  ClerkWebhookEventType 
} from '../interfaces/clerk.interfaces';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
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

    // 3. Processar evento
    await this.processEvent(event.type, event.data);

    return { received: true };
  }

  private async processEvent(
    type: ClerkWebhookEventType,
    data: ClerkUserData,
  ): Promise<void> {
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
