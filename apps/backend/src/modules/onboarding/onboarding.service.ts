// =============================================
// 🚀 ONBOARDING SERVICE
// =============================================
// Session 42: Guided post-signup onboarding.
// - Persists progress in Company.settings.onboardingProgress (JSON)
// - Auto-detects completion based on DB state on each GET
// - Clean Architecture: Application layer, orchestrates Domain + Infrastructure
// - Release It!: all Prisma calls are timeout-bounded via promiseAllWithTimeout
// =============================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { Prisma, AuditAction } from '@prisma/client';
import { promiseAllWithTimeout } from '../../common/resilience/promise-timeout';
import {
  EMPTY_ONBOARDING_PROGRESS,
  ONBOARDING_STEPS,
  STEP_CATALOG,
  computeProgressPercent,
  isOnboardingComplete,
  type OnboardingProgressState,
  type OnboardingStepId,
} from './constants';
import type { OnboardingProgressResponse } from './dto/onboarding.dto';

interface CompanySettingsShape {
  onboarded?: boolean;
  onboardingProgress?: OnboardingProgressState;
  [key: string]: unknown;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProgress(companyId: string): Promise<OnboardingProgressResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        settings: true,
        logoUrl: true,
        website: true,
        industry: true,
        whatsappPhoneNumberId: true,
      },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);

    const settings = (company.settings ?? {}) as CompanySettingsShape;
    let state: OnboardingProgressState =
      settings.onboardingProgress ?? EMPTY_ONBOARDING_PROGRESS();

    // Auto-detect steps from DB state on every read (self-healing).
    state = await this.autoDetect(companyId, state, {
      logoUrl: company.logoUrl,
      website: company.website,
      industry: company.industry,
      whatsappConfigured: !!company.whatsappPhoneNumberId,
    });

    // Persist only if auto-detect added new completions to avoid redundant writes.
    await this.persistIfChanged(companyId, settings, state);

    return this.toResponse(state);
  }

  async completeStep(
    companyId: string,
    userId: string,
    stepId: OnboardingStepId,
  ): Promise<OnboardingProgressResponse> {
    const state = await this.loadState(companyId);
    if (!state.stepsCompleted.includes(stepId)) {
      state.stepsCompleted.push(stepId);
      // Remove from skipped if previously skipped (user changed mind).
      state.stepsSkipped = state.stepsSkipped.filter((s) => s !== stepId);
      this.touch(state);
      await this.save(companyId, userId, state, AuditAction.UPDATE, `Onboarding step completed: ${stepId}`);
    }
    return this.toResponse(state);
  }

  async skipStep(
    companyId: string,
    userId: string,
    stepId: OnboardingStepId,
    reason?: string,
  ): Promise<OnboardingProgressResponse> {
    const state = await this.loadState(companyId);
    if (!state.stepsSkipped.includes(stepId) && !state.stepsCompleted.includes(stepId)) {
      state.stepsSkipped.push(stepId);
      this.touch(state);
      await this.save(
        companyId,
        userId,
        state,
        AuditAction.UPDATE,
        `Onboarding step skipped: ${stepId}${reason ? ` — ${reason}` : ''}`,
      );
    }
    return this.toResponse(state);
  }

  async dismiss(
    companyId: string,
    userId: string,
    feedback?: string,
  ): Promise<OnboardingProgressResponse> {
    const state = await this.loadState(companyId);
    state.dismissedAt = new Date().toISOString();
    this.touch(state);
    await this.save(
      companyId,
      userId,
      state,
      AuditAction.UPDATE,
      `Onboarding checklist dismissed${feedback ? ` — ${feedback}` : ''}`,
    );
    return this.toResponse(state);
  }

  async reset(companyId: string, userId: string): Promise<OnboardingProgressResponse> {
    const state = EMPTY_ONBOARDING_PROGRESS();
    await this.save(companyId, userId, state, AuditAction.UPDATE, 'Onboarding progress reset');
    return this.toResponse(state);
  }

  // =============================================
  // PRIVATE — Auto-detection logic
  // =============================================

  /**
   * Infers step completion from DB state. Self-healing: if a user convidou
   * manually (não via checklist), progresso é reconhecido.
   */
  private async autoDetect(
    companyId: string,
    state: OnboardingProgressState,
    companyFlags: {
      logoUrl: string | null;
      website: string | null;
      industry: string | null;
      whatsappConfigured: boolean;
    },
  ): Promise<OnboardingProgressState> {
    const detectable = STEP_CATALOG.filter((s) => s.autoDetectable).map((s) => s.id);
    const toCheck = detectable.filter(
      (id) => !state.stepsCompleted.includes(id) && !state.stepsSkipped.includes(id),
    );

    if (toCheck.length === 0) return state;

    const [userCount, callCount, chatCount, ownerUser] = await promiseAllWithTimeout(
      [
        this.prisma.user.count({ where: { companyId, isActive: true } }),
        this.prisma.call.count({ where: { companyId } }),
        this.prisma.whatsappChat.count({ where: { companyId } }),
        this.prisma.user.findFirst({
          where: { companyId, role: 'OWNER' },
          select: { avatarUrl: true, phone: true },
        }),
      ],
      10000,
      'onboarding.autoDetect',
    );

    const detected: OnboardingStepId[] = [];

    if (toCheck.includes('COMPLETE_PROFILE') && ownerUser?.avatarUrl && ownerUser?.phone) {
      detected.push('COMPLETE_PROFILE');
    }
    if (
      toCheck.includes('COMPANY_DETAILS') &&
      companyFlags.logoUrl &&
      companyFlags.website &&
      companyFlags.industry
    ) {
      detected.push('COMPANY_DETAILS');
    }
    if (toCheck.includes('INVITE_TEAM') && userCount > 1) {
      detected.push('INVITE_TEAM');
    }
    if (toCheck.includes('CONNECT_CHANNEL') && companyFlags.whatsappConfigured) {
      detected.push('CONNECT_CHANNEL');
    }
    if (toCheck.includes('FIRST_INTERACTION') && (callCount > 0 || chatCount > 0)) {
      detected.push('FIRST_INTERACTION');
    }

    if (detected.length > 0) {
      state.stepsCompleted = [...state.stepsCompleted, ...detected];
      this.touch(state);
      this.logger.log(
        `Auto-detected ${detected.length} step(s) for company ${companyId}: ${detected.join(', ')}`,
      );
    }

    return state;
  }

  // =============================================
  // PRIVATE — Persistence
  // =============================================

  private async loadState(companyId: string): Promise<OnboardingProgressState> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
    const settings = (company.settings ?? {}) as CompanySettingsShape;
    return settings.onboardingProgress ?? EMPTY_ONBOARDING_PROGRESS();
  }

  private touch(state: OnboardingProgressState): void {
    state.lastUpdatedAt = new Date().toISOString();
    if (isOnboardingComplete(state) && !state.completedAt) {
      state.completedAt = state.lastUpdatedAt;
    }
  }

  private async persistIfChanged(
    companyId: string,
    originalSettings: CompanySettingsShape,
    state: OnboardingProgressState,
  ): Promise<void> {
    const original = originalSettings.onboardingProgress;
    if (original && JSON.stringify(original) === JSON.stringify(state)) return;
    const nextSettings: CompanySettingsShape = {
      ...originalSettings,
      onboardingProgress: state,
    };
    await this.prisma.company.update({
      where: { id: companyId },
      data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
    });
  }

  private async save(
    companyId: string,
    userId: string,
    state: OnboardingProgressState,
    action: AuditAction,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { settings: true },
      });
      const settings = (company?.settings ?? {}) as CompanySettingsShape;
      const nextSettings: CompanySettingsShape = { ...settings, onboardingProgress: state };
      await tx.company.update({
        where: { id: companyId },
        data: { settings: nextSettings as unknown as Prisma.InputJsonValue },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'onboarding',
          resourceId: companyId,
          description,
          newValues: { onboardingProgress: state } as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  private toResponse(state: OnboardingProgressState): OnboardingProgressResponse {
    const completedSet = new Set(state.stepsCompleted);
    const skippedSet = new Set(state.stepsSkipped);
    return {
      percent: computeProgressPercent(state),
      isComplete: isOnboardingComplete(state),
      isDismissed: !!state.dismissedAt,
      stepsCompleted: state.stepsCompleted,
      stepsSkipped: state.stepsSkipped,
      completedAt: state.completedAt,
      dismissedAt: state.dismissedAt,
      startedAt: state.startedAt,
      steps: ONBOARDING_STEPS.map((id) => {
        const def = STEP_CATALOG.find((s) => s.id === id)!;
        const status: 'pending' | 'completed' | 'skipped' = completedSet.has(id)
          ? 'completed'
          : skippedSet.has(id)
            ? 'skipped'
            : 'pending';
        return {
          id,
          order: def.order,
          actionUrl: def.actionUrl,
          estimatedMinutes: def.estimatedMinutes,
          status,
        };
      }),
    };
  }
}
