// ====================================================
// 🏢 COMPANIES SERVICE
// ====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const data: Prisma.CompanyUpdateInput = {};

    // Only include fields that are provided
    if (updateCompanyDto.name !== undefined) {
      data.name = updateCompanyDto.name;
    }

    if (updateCompanyDto.slug !== undefined) {
      data.slug = updateCompanyDto.slug;
    }

    if (updateCompanyDto.plan !== undefined) {
      data.plan = updateCompanyDto.plan;
    }

    if (updateCompanyDto.stripeCustomerId !== undefined) {
      data.stripeCustomerId = updateCompanyDto.stripeCustomerId;
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  /**
   * Get company statistics
   * Efficient parallel queries using Promise.all
   */
  async getStats(id: string) {
    // Check if company exists
    await this.findOne(id);

    const [totalCalls, totalChats, totalUsers, activeCalls] =
      await Promise.all([
        this.prisma.call.count({ where: { companyId: id } }),
        this.prisma.whatsappChat.count({ where: { companyId: id } }),
        this.prisma.user.count({ where: { companyId: id } }),
        this.prisma.call.count({
          where: { companyId: id, status: 'IN_PROGRESS' },
        }),
      ]);

    return {
      totalCalls,
      totalChats,
      totalUsers,
      activeCalls,
    };
  }
}