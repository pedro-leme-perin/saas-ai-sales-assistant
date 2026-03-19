import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './infrastructure/database/prisma.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HealthModule } from './health/health.module';

import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CallsModule } from './modules/calls/calls.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { AiModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Rate Limiting (System Design Interview - Cap. 4: Sliding Window)
    // Multiple tiers: default, strict (AI/auth), webhook (relaxed)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },    // 100 req/min general
      { name: 'strict', ttl: 60000, limit: 20 },       // 20 req/min for AI endpoints
      { name: 'auth', ttl: 60000, limit: 10 },          // 10 req/min for auth attempts
    ]),
    PrismaModule,
    CacheModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    CallsModule,
    WhatsappModule,
    AiModule,
    BillingModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [
    // Activate ThrottlerGuard globally (System Design Interview - Cap. 4)
    // Without this, @Throttle() decorators on controllers have no effect
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}


