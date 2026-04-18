// src/modules/users/users.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { User, Company, UserRole, Plan, UserStatus, Prisma, AuditAction } from '@prisma/client';
import {
  ClerkJwtPayload,
  ClerkUserData,
  CreateUserFromClerkDto,
} from '../auth/interfaces/clerk.interfaces';
import { EmailService } from '../email/email.service';

// Tipo com company incluída
export type UserWithCompany = User & { company: Company };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

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

  async findAllByCompany(companyId: string, limit = 50) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        status: true,
        phone: true,
        createdAt: true,
      },
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
        Authorization: `Bearer ${clerkSecretKey}`,
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

  private async getOrCreateCompany(tx: Prisma.TransactionClient, email: string): Promise<Company> {
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
    const companyName =
      domain && !this.isGenericEmailDomain(domain)
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

    // Check if there's a PENDING user with this email to match
    const email = clerkData.email_addresses?.[0]?.email_address;
    if (email) {
      const pendingUser = await this.prisma.user.findFirst({
        where: {
          email,
          status: 'PENDING',
        },
        include: { company: true },
      });

      if (pendingUser) {
        this.logger.log(`Found pending user, updating with Clerk data: ${pendingUser.id}`);
        return this.prisma.user.update({
          where: { id: pendingUser.id },
          data: {
            clerkId: clerkData.id,
            name: this.buildFullName(clerkData.first_name, clerkData.last_name) || pendingUser.name,
            avatarUrl: clerkData.image_url,
            phone: clerkData.phone_numbers?.[0]?.phone_number,
            status: 'ACTIVE',
            isActive: true,
          },
          include: { company: true },
        });
      }
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
  // TEAM MANAGEMENT - INVITE / REMOVE / ROLE UPDATE
  // ============================================

  async inviteUser(
    companyId: string,
    email: string,
    role: UserRole,
    inviterId: string,
  ): Promise<{ success: boolean; message: string; userId: string }> {
    this.logger.log(`Inviting user ${email} to company ${companyId}`);

    // Validate email format
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Invalid email format');
    }

    // Check if user already exists in this company
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        companyId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists in this company');
    }

    // Create PENDING user
    const pendingClerkId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const user = await this.prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        role,
        companyId,
        clerkId: pendingClerkId,
        status: 'PENDING',
        isActive: false,
      },
    });

    // Log the invite action
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId: inviterId,
        action: 'INVITE' as AuditAction,
        resource: 'USER',
        resourceId: user.id,
        description: `Invited user ${email} with role ${role}`,
        newValues: {
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });

    this.logger.log(`User invitation created: ${user.id} (${user.email})`);

    // Send invitation email (non-blocking — don't fail invite if email fails)
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { name: true },
    });
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    this.emailService
      .sendInviteEmail({
        recipientEmail: email,
        inviterName: inviter?.name || 'Um membro da equipe',
        companyName: company?.name || 'Sua empresa',
        role,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Non-blocking: invite email failed for ${email}: ${message}`);
      });

    return {
      success: true,
      message: 'Invitation created successfully',
      userId: user.id,
    };
  }

  async removeUser(
    userId: string,
    companyId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Removing user ${userId} from company ${companyId}`);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't allow removing the last ADMIN
    const adminCount = await this.prisma.user.count({
      where: {
        companyId,
        role: 'ADMIN',
        isActive: true,
      },
    });

    if (user.role === 'ADMIN' && adminCount === 1) {
      throw new BadRequestException('Cannot remove the last admin from the company');
    }

    // Soft delete or hard delete based on status
    if (user.status === 'PENDING') {
      // Hard delete pending users
      await this.prisma.user.delete({
        where: { id: userId },
      });
    } else {
      // Soft delete active users
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          status: 'INACTIVE',
          deletedAt: new Date(),
        },
      });
    }

    // Log the removal
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId: userId,
        action: 'DELETE' as AuditAction,
        resource: 'USER',
        resourceId: userId,
        description: `User ${user.email} was removed`,
        oldValues: {
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });

    this.logger.log(`User removed: ${userId}`);

    return {
      success: true,
      message: 'User removed successfully',
    };
  }

  async updateUserRole(userId: string, companyId: string, newRole: UserRole): Promise<User> {
    this.logger.log(`Updating role for user ${userId} to ${newRole}`);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === newRole) {
      throw new BadRequestException('New role is the same as current role');
    }

    // Store old role for audit log
    const oldRole = user.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        updatedAt: new Date(),
      },
    });

    // Log the role change
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId: userId,
        action: 'UPDATE' as AuditAction,
        resource: 'USER',
        resourceId: userId,
        description: `User role changed from ${oldRole} to ${newRole}`,
        oldValues: {
          role: oldRole,
        },
        newValues: {
          role: newRole,
        },
      },
    });

    this.logger.log(`User role updated: ${userId} from ${oldRole} to ${newRole}`);

    return updated;
  }

  // ============================================
  // LGPD COMPLIANCE (Lei Geral de Protecao de Dados)
  // ============================================

  /**
   * LGPD Art. 18, V — Data portability.
   * Collects all user data within their tenant for export.
   */
  async exportUserData(userId: string, companyId: string): Promise<Record<string, unknown>> {
    this.logger.log(`Exporting data for user ${userId} in company ${companyId}`);

    const user = await this.findByIdOrThrow(userId, companyId);

    const [calls, whatsappChats, aiSuggestions, notifications, auditLogs] = await Promise.all([
      this.prisma.call.findMany({
        where: { userId, companyId },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      this.prisma.whatsappChat.findMany({
        where: { userId, companyId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10000,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      this.prisma.aISuggestion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      this.prisma.notification.findMany({
        where: { userId, companyId },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      this.prisma.auditLog.findMany({
        where: { userId, companyId },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
    ]);

    // Log the export action
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'EXPORT' as AuditAction,
        resource: 'USER',
        resourceId: userId,
        description: 'LGPD data export requested',
      },
    });

    this.logger.log(
      `Data export completed for user ${userId}: ` +
        `${calls.length} calls, ${whatsappChats.length} chats, ` +
        `${aiSuggestions.length} suggestions, ${notifications.length} notifications, ` +
        `${auditLogs.length} audit logs`,
    );

    return {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        plan: user.company.plan,
      },
      calls,
      whatsappChats,
      aiSuggestions,
      notifications,
      auditLogs,
    };
  }

  /**
   * LGPD Art. 18, VI — Data deletion.
   * Suspends the account and schedules deletion in 30 days.
   */
  async requestAccountDeletion(
    userId: string,
    companyId: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    message: string;
    scheduledDeletionDate: Date;
  }> {
    this.logger.log(`Account deletion requested for user ${userId} in company ${companyId}`);

    const user = await this.findByIdOrThrow(userId, companyId);

    const scheduledDeletionDate = new Date();
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

    // Suspend the user account + persist scheduled deletion (LGPD cron picks it up)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED' as UserStatus,
        isActive: false,
        scheduledDeletionAt: scheduledDeletionDate,
        deletionReason: reason ?? null,
        updatedAt: new Date(),
      },
    });

    // Log the deletion request
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'DELETE' as AuditAction,
        resource: 'USER',
        resourceId: userId,
        description: `LGPD deletion request — scheduled for ${scheduledDeletionDate.toISOString()}`,
        oldValues: {
          status: user.status,
          reason: reason || null,
        },
        newValues: {
          status: 'SUSPENDED',
          scheduledDeletionDate: scheduledDeletionDate.toISOString(),
        },
      },
    });

    // Send confirmation email (non-blocking)
    this.emailService
      .sendDeletionRequestEmail({
        recipientEmail: user.email,
        userName: user.name,
        scheduledDeletionDate,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Non-blocking: deletion confirmation email failed for ${user.email}: ${message}`,
        );
      });

    this.logger.log(
      `Account deletion scheduled for user ${userId} on ${scheduledDeletionDate.toISOString()}`,
    );

    return {
      success: true,
      message:
        'Your account has been suspended and is scheduled for deletion. ' +
        'You will receive a confirmation email shortly.',
      scheduledDeletionDate,
    };
  }

  /**
   * Cancel a pending deletion request (user changed their mind within the 30d grace).
   * LGPD Art. 18 — allows the subject to withdraw consent at any time.
   */
  async cancelAccountDeletion(
    userId: string,
    companyId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findByIdOrThrow(userId, companyId);

    if (!user.scheduledDeletionAt) {
      return { success: false, message: 'No deletion is scheduled for this account.' };
    }

    const previousScheduledAt = user.scheduledDeletionAt.toISOString();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE' as UserStatus,
          isActive: true,
          scheduledDeletionAt: null,
          deletionReason: null,
          updatedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'UPDATE' as AuditAction,
          resource: 'USER',
          resourceId: userId,
          description: 'LGPD deletion request cancelled by user',
          oldValues: {
            scheduledDeletionAt: previousScheduledAt,
            status: 'SUSPENDED',
          },
          newValues: { scheduledDeletionAt: null, status: 'ACTIVE' },
        },
      });
    });

    this.logger.log(`Account deletion cancelled for user ${userId}`);
    return { success: true, message: 'Deletion request cancelled. Your account is active again.' };
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
      'gmail.com',
      'googlemail.com',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'yahoo.com',
      'yahoo.com.br',
      'icloud.com',
      'me.com',
      'protonmail.com',
      'proton.me',
      'aol.com',
      'mail.com',
      'zoho.com',
      'uol.com.br',
      'bol.com.br',
      'terra.com.br',
      'ig.com.br',
      'globo.com',
      'pending.local',
    ];
    return genericDomains.includes(domain.toLowerCase());
  }

  private domainToCompanyName(domain: string): string {
    const name = domain
      .replace(/\.(com|net|org|io|co|app|dev|br|us|uk|de|fr|es|it|pt)(\.[a-z]{2})?$/i, '')
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return name || domain;
  }
}
