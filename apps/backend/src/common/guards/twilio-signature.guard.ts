// =====================================================
// 🔐 TWILIO SIGNATURE GUARD
// =====================================================
// Validates Twilio webhook requests using X-Twilio-Signature header
// Prevents webhook spoofing attacks
// Reference: Release It! — Stability Patterns (Fail Fast)
// =====================================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    // Skip validation in development/test or when Twilio is not configured
    if (!authToken || process.env.NODE_ENV === 'test') {
      this.logger.debug('Twilio signature validation skipped (no auth token or test env)');
      return true;
    }

    const signature = request.headers['x-twilio-signature'] as string;
    if (!signature) {
      this.logger.warn('⚠️ Twilio webhook request missing X-Twilio-Signature header');
      throw new BadRequestException('Missing Twilio signature');
    }

    // Build the full URL that Twilio signed
    const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'https';
    const host = request.headers['host'] || 'localhost';
    const url = `${protocol}://${host}${request.originalUrl}`;

    const isValid = validateRequest(authToken, signature, url, request.body || {});

    if (!isValid) {
      this.logger.warn(`⚠️ Invalid Twilio signature for ${request.originalUrl}`);
      throw new BadRequestException('Invalid Twilio signature');
    }

    this.logger.debug(`Twilio signature validated for ${request.originalUrl}`);
    return true;
  }
}
