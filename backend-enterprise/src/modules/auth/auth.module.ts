// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

// Strategy
import { ClerkStrategy } from './strategies/clerk.strategy';

// Guards
import { AuthGuard } from './guards/auth.guard';

// Controllers
import { AuthController } from './auth.controller';
import { ClerkWebhookController } from './webhooks/clerk-webhook.controller';

// Services (importados de outros módulos)
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'clerk' }),
    UsersModule,
  ],
  controllers: [
    AuthController,
    ClerkWebhookController,
  ],
  providers: [
    ClerkStrategy,
    // Registrar AuthGuard globalmente
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [ClerkStrategy],
})
export class AuthModule {}
