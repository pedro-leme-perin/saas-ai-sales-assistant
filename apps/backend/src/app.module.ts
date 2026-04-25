import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

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
import { TagsModule } from './modules/tags/tags.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { SavedFiltersModule } from './modules/saved-filters/saved-filters.module';
import { BackgroundJobsModule } from './modules/background-jobs/background-jobs.module';
import { SlaPoliciesModule } from './modules/sla-policies/sla-policies.module';
import { SlaEscalationModule } from './modules/sla-escalation/sla-escalation.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CsatModule } from './modules/csat/csat.module';
import { ScheduledExportsModule } from './modules/scheduled-exports/scheduled-exports.module';
import { RetentionPoliciesModule } from './modules/retention-policies/retention-policies.module';
import { ApiRequestLogsModule } from './modules/api-request-logs/api-request-logs.module';
import { ApiRequestLogsInterceptor } from './modules/api-request-logs/api-request-logs.interceptor';
import { BulkActionsModule } from './modules/bulk-actions/bulk-actions.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { DataImportModule } from './modules/data-import/data-import.module';
import { PresenceModule } from './modules/presence/presence.module';
import { AssignmentRulesModule } from './modules/assignment-rules/assignment-rules.module';
import { AgentSkillsModule } from './modules/agent-skills/agent-skills.module';
import { CsatTrendsModule } from './modules/csat-trends/csat-trends.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { UsageQuotasModule } from './modules/usage-quotas/usage-quotas.module';
import { ScheduledMessagesModule } from './modules/scheduled-messages/scheduled-messages.module';
import { MacrosModule } from './modules/macros/macros.module';
import { ImpersonationModule } from './modules/impersonation/impersonation.module';
import { ConfigSnapshotsModule } from './modules/config-snapshots/config-snapshots.module';
import { DsarModule } from './modules/dsar/dsar.module';
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
    TagsModule,
    ApiKeysModule,
    NotificationPreferencesModule,
    SavedFiltersModule,
    BackgroundJobsModule,
    SlaPoliciesModule,
    SlaEscalationModule,
    ContactsModule,
    CsatModule,
    ScheduledExportsModule,
    RetentionPoliciesModule,
    ApiRequestLogsModule,
    BulkActionsModule,
    FeatureFlagsModule,
    AnnouncementsModule,
    DataImportModule,
    PresenceModule,
    AssignmentRulesModule,
    AgentSkillsModule,
    CsatTrendsModule,
    CustomFieldsModule,
    UsageQuotasModule,
    ScheduledMessagesModule,
    MacrosModule,
    ImpersonationModule,
    ConfigSnapshotsModule,
    DsarModule,
  ],
  providers: [
    // CompanyThrottlerGuard: Redis sliding window per companyId
    // Falls back to IP-based ThrottlerGuard for unauthenticated requests
    // Plan-based limits: STARTER(60/min) < PROFESSIONAL(200/min) < ENTERPRISE(500/min)
    { provide: APP_GUARD, useClass: CompanyThrottlerGuard },
    // Buffered writer for per-tenant API request audit trail
    { provide: APP_INTERCEPTOR, useClass: ApiRequestLogsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Security headers + request ID first (stateless, no DB dependency)
    consumer.apply(RequestIdMiddleware, SecurityHeadersMiddleware).forRoutes('*');
    // Inject company.plan into request for rate-limit guard (per-tenant tiers)
    consumer.apply(CompanyPlanMiddleware).forRoutes('*');
  }
}
