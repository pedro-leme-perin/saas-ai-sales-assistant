// =====================================================
// COMPANY PLAN MIDDLEWARE
// =====================================================
// Injects company.plan into request for rate limiting
// Based on: System Design Interview Cap.4 - Rate Limiting
//
// After AuthGuard populates req.user with companyId,
// this middleware loads the company's plan from cache/DB
// so CompanyThrottlerGuard can apply plan-based limits.
// =====================================================

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    companyId?: string;
    company?: { plan: string };
    [key: string]: unknown;
  };
}

const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class CompanyPlanMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CompanyPlanMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async use(req: RequestWithUser, _res: Response, next: NextFunction): Promise<void> {
    const companyId = req.user?.companyId;

    if (!companyId) {
      next();
      return;
    }

    // Already populated (e.g., by ClerkStrategy with eager load)
    if (req.user?.company?.plan) {
      next();
      return;
    }

    try {
      // Check cache first
      const cacheKey = `company:plan:${companyId}`;
      const cachedPlan = await this.cache.get(cacheKey);

      if (cachedPlan) {
        req.user!.company = { plan: cachedPlan as string };
        next();
        return;
      }

      // Fetch from DB
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { plan: true },
      });

      if (company) {
        req.user!.company = { plan: company.plan };
        await this.cache.set(cacheKey, company.plan, CACHE_TTL_SECONDS);
      }
    } catch (error: unknown) {
      // Non-blocking — default to STARTER in guard if company not found
      this.logger.warn(
        `Failed to load company plan for ${companyId}: ${error instanceof Error ? error.message : error}`,
      );
    }

    next();
  }
}
