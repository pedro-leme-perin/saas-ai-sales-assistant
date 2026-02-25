// =============================================
// 🔐 AUTH SERVICE
// =============================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@/infrastructure/cache/cache.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      company: user.company,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
  }

  async handleClerkWebhook(payload: any) {
    const { type, data } = payload;

    switch (type) {
      case 'user.created':
        await this.handleUserCreated(data);
        break;
      case 'user.updated':
        await this.handleUserUpdated(data);
        break;
      case 'user.deleted':
        await this.handleUserDeleted(data);
        break;
      default:
        this.logger.log(`Unhandled Clerk event: ${type}`);
    }

    return { received: true };
  }

  private async handleUserCreated(data: any) {
    this.logger.log(`New Clerk user: ${data.id}`);
    // User creation is handled during invitation/signup flow
  }

  private async handleUserUpdated(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: data.id },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: data.email_addresses?.[0]?.email_address || user.email,
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || user.name,
          avatarUrl: data.image_url || user.avatarUrl,
        },
      });

      // Invalidate cache
      await this.cache.delete(`user:clerk:${data.id}`);
    }
  }

  private async handleUserDeleted(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: data.id },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      await this.cache.delete(`user:clerk:${data.id}`);
      await this.cache.deleteSession(data.id);
      this.logger.log(`🗑️ User cache cleared: ${data.id}`);
    }
  }
}