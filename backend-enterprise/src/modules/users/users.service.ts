// src/modules/users/users.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { User, Company, UserRole, Plan, UserStatus, Prisma } from '@prisma/client';
import { 
  ClerkJwtPayload, 
  ClerkUserData,
  CreateUserFromClerkDto 
} from '../auth/interfaces/clerk.interfaces';

// Tipo com company incluída
export type UserWithCompany = User & { company: Company };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // BUSCA
  // ============================================

  async findByClerkId(clerkId: string): Promise<UserWithCompany | null> {
    this.logger.debug(`Finding user by clerkId: ${clerkId}`);
    
    return this.prisma.user.findUnique({
      where: { clerkId },
      include: { company: true },
    });
  }

  async findById(id: string, companyId: string): Promise<UserWithCompany | null> {
    return this.prisma.user.findFirst({
      where: { 
        id,
        companyId,
      },
      include: { company: true },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<UserWithCompany> {
    const user = await this.findById(id, companyId);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string, companyId?: string): Promise<UserWithCompany | null> {
    const where: Prisma.UserWhereInput = { email };
    if (companyId) {
      where.companyId = companyId;
    }
    
    return this.prisma.user.findFirst({
      where,
      include: { company: true },
    });
  }

  // ============================================
  // AUTO-PROVISIONING
  // ============================================

  async createFromClerkPayload(payload: ClerkJwtPayload): Promise<UserWithCompany> {
    this.logger.log(`Auto-provisioning user from Clerk: ${payload.sub}`);

    // Verificar se já existe (race condition protection)
    const existing = await this.findByClerkId(payload.sub);
    if (existing) {
      this.logger.debug(`User already exists: ${existing.id}`);
      return existing;
    }

    // Tentar buscar dados completos do Clerk
    let userData: CreateUserFromClerkDto;
    
    try {
      userData = await this.fetchClerkUserData(payload.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Could not fetch Clerk user data, using minimal data: ${message}`);
      userData = {
        clerkId: payload.sub,
        email: `${payload.sub}@pending.local`,
        name: 'Usuário Pendente',
      };
    }

    return this.createUserWithCompany(userData);
  }

  private async fetchClerkUserData(clerkId: string): Promise<CreateUserFromClerkDto> {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    
    if (!clerkSecretKey) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: {
        'Authorization': `Bearer ${clerkSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status}`);
    }

    const json = await response.json();
    const clerkUser = json as ClerkUserData;
    
    return {
      clerkId: clerkUser.id,
      email: clerkUser.email_addresses?.[0]?.email_address ?? '',
      name: this.buildFullName(clerkUser.first_name, clerkUser.last_name),
      avatarUrl: clerkUser.image_url,
      phone: clerkUser.phone_numbers?.[0]?.phone_number,
    };
  }

  private async createUserWithCompany(data: CreateUserFromClerkDto): Promise<UserWithCompany> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Buscar ou criar company
      const company = await this.getOrCreateCompany(tx, data.email);

      // 2. Verificar se é o primeiro usuário da company
      const existingUsersCount = await tx.user.count({
        where: { companyId: company.id },
      });
      
      const role: UserRole = existingUsersCount === 0 ? 'ADMIN' : 'VENDOR';

      // 3. Criar usuário
      const user = await tx.user.create({
        data: {
          clerkId: data.clerkId,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          phone: data.phone,
          role,
          companyId: company.id,
          status: 'ACTIVE' as UserStatus,
          isActive: true,
        },
        include: { company: true },
      });

      this.logger.log(`User created: ${user.id} (${user.email}) in company ${company.name}`);
      
      return user;
    });
  }

  private async getOrCreateCompany(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<Company> {
    const domain = this.extractDomain(email);
    
    // Tentar encontrar company pelo domínio
    if (domain && !this.isGenericEmailDomain(domain)) {
      const existingCompany = await tx.company.findFirst({
        where: {
          users: {
            some: {
              email: { endsWith: `@${domain}` },
            },
          },
        },
      });

      if (existingCompany) {
        this.logger.debug(`Found existing company for domain ${domain}: ${existingCompany.name}`);
        return existingCompany;
      }
    }

    // Criar nova company
    const companyName = domain && !this.isGenericEmailDomain(domain)
      ? this.domainToCompanyName(domain)
      : `Company ${Date.now()}`;

    const company = await tx.company.create({
      data: {
        name: companyName,
        plan: 'STARTER' as Plan,
      },
    });

    this.logger.log(`Created new company: ${company.id} (${company.name})`);
    
    return company;
  }

  // ============================================
  // WEBHOOK HANDLERS
  // ============================================

  async createFromWebhook(clerkData: ClerkUserData): Promise<UserWithCompany> {
    this.logger.log(`Creating user from webhook: ${clerkData.id}`);

    const existing = await this.findByClerkId(clerkData.id);
    if (existing) {
      this.logger.debug(`User already exists from webhook: ${existing.id}`);
      return existing;
    }

    const userData: CreateUserFromClerkDto = {
      clerkId: clerkData.id,
      email: clerkData.email_addresses?.[0]?.email_address ?? '',
      name: this.buildFullName(clerkData.first_name, clerkData.last_name),
      avatarUrl: clerkData.image_url,
      phone: clerkData.phone_numbers?.[0]?.phone_number,
    };

    return this.createUserWithCompany(userData);
  }

  async updateFromWebhook(clerkData: ClerkUserData): Promise<UserWithCompany | null> {
    this.logger.log(`Updating user from webhook: ${clerkData.id}`);

    const user = await this.findByClerkId(clerkData.id);
    if (!user) {
      this.logger.warn(`User not found for update webhook: ${clerkData.id}`);
      return this.createFromWebhook(clerkData);
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: clerkData.email_addresses?.[0]?.email_address ?? user.email,
        name: this.buildFullName(clerkData.first_name, clerkData.last_name) || user.name,
        avatarUrl: clerkData.image_url ?? user.avatarUrl,
        phone: clerkData.phone_numbers?.[0]?.phone_number ?? user.phone,
        updatedAt: new Date(),
      },
      include: { company: true },
    });
  }

  async softDeleteByClerkId(clerkId: string): Promise<void> {
    this.logger.log(`Soft deleting user from webhook: ${clerkId}`);

    const user = await this.findByClerkId(clerkId);
    if (!user) {
      this.logger.warn(`User not found for delete webhook: ${clerkId}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        status: 'INACTIVE' as UserStatus,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`User soft deleted: ${user.id}`);
  }

  // ============================================
  // UPDATE LAST ACCESS
  // ============================================

  async updateLastAccess(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private buildFullName(firstName?: string | null, lastName?: string | null): string {
    const parts = [firstName, lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Usuário';
  }

  private extractDomain(email: string): string | null {
    const match = email.match(/@([^@]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  private isGenericEmailDomain(domain: string): boolean {
    const genericDomains = [
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com',
      'live.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com', 'me.com',
      'protonmail.com', 'proton.me', 'aol.com', 'mail.com', 'zoho.com',
      'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com',
      'pending.local',
    ];
    return genericDomains.includes(domain.toLowerCase());
  }

  private domainToCompanyName(domain: string): string {
    const name = domain
      .replace(/\.(com|net|org|io|co|app|dev|br|us|uk|de|fr|es|it|pt)(\.[a-z]{2})?$/i, '')
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    return name || domain;
  }
}
