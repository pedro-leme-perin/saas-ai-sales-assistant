import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './infrastructure/database/prisma.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { TelemetryModule } from './infrastructure/telemetry/telemetry.module';
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
import { EmailModule } from './modules/email/email.module';
import { UploadModule } from './modules/upload/upload.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PaymentRecoveryModule } from './modules/payment-recovery/payment-recovery.module';
import { LgpdDeletionModule } from './modules/lgpd-deletion/lgpd-deletion.module';
import { SummariesModule } from './modules/summaries/summaries.module';
import { CoachingModule } from './modules/coaching/coaching.module';
import { GoalsModule } from './modules/goals/goals.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ReplyTemplatesModule } from './modules/reply-templates/reply-templates.module';
import { CompanyThrottlerGuard } from './common/guards/company-throttler.guard';
import { CompanyPlanMiddleware } from './common/middleware/company-plan.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Rate Limiting (System Design Interview - Cap. 4: Sliding Window)
    // ThrottlerModule still needed for decorator metadata + IP-based fallback
    // Actual per-company limits enforced by CompanyThrottlerGuard via Redis
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'strict', ttl: 60000, limit: 20 },
      { name: 'auth', ttl: 60000, limit: 10 },
    ]),
    // Scheduled jobs (dunning cron, cleanup tasks)
    ScheduleModule.forRoot(),
    // In-process event bus (loose coupling for webhooks fan-out)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: true,
    }),
    PrismaModule,
    CacheModule,
    TelemetryModule,
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
    EmailModule,
    UploadModule,
    OnboardingModule,
    PaymentRecoveryModule,
    LgpdDeletionModule,
    SummariesModule,
    CoachingModule,
    GoalsModule,
    WebhooksModule,
    ReplyTemplatesModule,
  ],
  providers: [
    // CompanyThrottlerGuard: Redis sliding window per companyId
    // Falls back to IP-based ThrottlerGuard for unauthenticated requests
    // Plan-based limits: STARTER(60/min) < PROFESSIONAL(200/min) < ENTERPRISE(500/min)
    { provide: APP_GUARD, useClass: CompanyThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Security headers + request ID first (stateless, no DB dependency)
    consumer.apply(RequestIdMiddleware, SecurityHeadersMiddleware).forRoutes('*');
    // Inject company.plan into request for rate limiting
    consumer.apply(CompanyPlanMiddleware).forRoutes('*');
  }
}
