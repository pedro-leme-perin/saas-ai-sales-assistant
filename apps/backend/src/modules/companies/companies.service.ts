// ====================================================
// 🏢 COMPANIES SERVICE
// ====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { promiseAllWithTimeout } from '../../common/resilience/promise-timeout';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Cache key matches AnalyticsService.dashboardCacheKey() */
  private analyticsCacheKey(companyId: string): string {
    return `analytics:dashboard:${companyId}`;
  }

  /**
   * Create a new company
   * Following Clean Architecture principles - only include defined fields
   */
  async create(createCompanyDto: CreateCompanyDto) {
    const data: Prisma.CompanyCreateInput = {
      name: createCompanyDto.name,
    };

    // Only include optional fields if they are provided
    if (createCompanyDto.slug !== undefined) {
      data.slug = createCompanyDto.slug;
    }

    if (createCompanyDto.plan !== undefined) {
      data.plan = createCompanyDto.plan;
    }

    if (createCompanyDto.stripeCustomerId !== undefined) {
      data.stripeCustomerId = createCompanyDto.stripeCustomerId;
    }

    return this.prisma.company.create({ data });
  }

  /**
   * Find one company by ID with related data
   */
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            calls: true,
            whatsappChats: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  /**
   * Update company data
   * Following SOLID principles - only update provided fields
   */
  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    // Check if company exists
    await this.findOne(id);

    const allowedFields: (keyof UpdateCompanyDto)[] = [
      'name',
      'slug',
      'plan',
      'stripeCustomerId',
      'website',
      'industry',
      'logoUrl',
      'timezone',
      'metadata',
    ];

    const data: Prisma.CompanyUpdateInput = {};
    for (const field of allowedFields) {
      if (updateCompanyDto[field] !== undefined) {
        (data as Record<string, unknown>)[field] = updateCompanyDto[field];
      }
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  /**
   * Complete onboarding — sets metadata.onboarded = true
   * Bypasses UpdateCompanyDto to avoid DTO cache issues
   */
  async completeOnboarding(companyId: string, dto: CompleteOnboardingDto) {
    await this.findOne(companyId);

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.companyName.trim(),
        industry: dto.industry || undefined,
        settings: {
          onboarded: true,
          teamSize: dto.teamSize || null,
          industry: dto.industry || null,
          channels: dto.channels || [],
          selectedPlan: dto.selectedPlan || 'STARTER',
          onboardedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    // Invalidate dashboard cache so KPIs reflect new company state immediately
    await this.cache.del(this.analyticsCacheKey(companyId));

    return updated;
  }

  /**
   * Get company statistics
   * Efficient parallel queries using Promise.all
   */
  async getStats(id: string) {
    // Check if company exists
    await this.findOne(id);

    const [totalCalls, totalChats, totalUsers, activeCalls] = await promiseAllWithTimeout(
      [
        this.prisma.call.count({ where: { companyId: id } }),
        this.prisma.whatsappChat.count({ where: { companyId: id } }),
        this.prisma.user.count({ where: { companyId: id } }),
        this.prisma.call.count({
          where: { companyId: id, status: 'IN_PROGRESS' },
        }),
      ],
      15000,
      'getCompanyStats',
    );

    return {
      totalCalls,
      totalChats,
      totalUsers,
      activeCalls,
    };
  }
}
