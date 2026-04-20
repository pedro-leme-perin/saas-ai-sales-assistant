// =============================================
// 📄 SAVED FILTERS SERVICE (Session 48)
// =============================================
// User or shared query presets for calls/chats.
// filterJson is validated against a Zod schema on write (coerces + drops unknown keys).

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AuditAction, FilterResource, Prisma } from '@prisma/client';
import { z } from 'zod';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

const FilterJsonSchema = z
  .object({
    q: z.string().max(200).optional(),
    tagIds: z.array(z.string().uuid()).max(20).optional(),
    sentiment: z
      .array(z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'VERY_POSITIVE', 'VERY_NEGATIVE']))
      .optional(),
    status: z.array(z.string().max(32)).max(10).optional(),
    priority: z.array(z.string().max(32)).max(10).optional(),
    assigneeId: z.string().uuid().optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    minDuration: z.number().int().nonnegative().optional(),
    maxDuration: z.number().int().nonnegative().optional(),
    direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  })
  .strict();

export type SavedFilterJson = z.infer<typeof FilterJsonSchema>;

@Injectable()
export class SavedFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, userId: string, resource?: FilterResource) {
    this.assertTenant(companyId);
    return this.prisma.savedFilter.findMany({
      where: {
        companyId,
        resource: resource ?? undefined,
        OR: [{ userId }, { userId: null }],
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async findById(companyId: string, userId: string, id: string) {
    this.assertTenant(companyId);
    const filter = await this.prisma.savedFilter.findFirst({
      where: { id, companyId, OR: [{ userId }, { userId: null }] },
    });
    if (!filter) throw new NotFoundException('Saved filter not found');
    return filter;
  }

  async create(companyId: string, userId: string, dto: CreateSavedFilterDto) {
    this.assertTenant(companyId);
    const safeFilter = this.validateFilterJson(dto.filterJson);
    try {
      const row = await this.prisma.savedFilter.create({
        data: {
          companyId,
          userId: dto.shared ? null : userId,
          name: dto.name,
          resource: dto.resource,
          filterJson: safeFilter as unknown as Prisma.InputJsonValue,
          isPinned: dto.isPinned ?? false,
        },
      });
      await this.audit(companyId, userId, 'CREATE', row.id, {
        name: row.name,
        resource: row.resource,
      });
      return row;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('A filter with that name already exists');
      }
      throw err;
    }
  }

  async update(companyId: string, userId: string, id: string, dto: UpdateSavedFilterDto) {
    this.assertTenant(companyId);
    const existing = await this.findById(companyId, userId, id);
    if (existing.userId && existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }

    const patch: Prisma.SavedFilterUpdateInput = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.filterJson !== undefined) {
      const safe = this.validateFilterJson(dto.filterJson);
      patch.filterJson = safe as unknown as Prisma.InputJsonValue;
    }
    if (dto.isPinned !== undefined) patch.isPinned = dto.isPinned;

    const updated = await this.prisma.savedFilter.update({ where: { id }, data: patch });
    await this.audit(companyId, userId, 'UPDATE', id, {
      oldValues: { name: existing.name, isPinned: existing.isPinned },
      newValues: { name: updated.name, isPinned: updated.isPinned },
    });
    return updated;
  }

  async remove(companyId: string, userId: string, id: string) {
    this.assertTenant(companyId);
    const existing = await this.findById(companyId, userId, id);
    if (existing.userId && existing.userId !== userId) {
      throw new NotFoundException('Saved filter not found');
    }
    await this.prisma.savedFilter.delete({ where: { id } });
    await this.audit(companyId, userId, 'DELETE', id, { name: existing.name });
    return { success: true };
  }

  async togglePin(companyId: string, userId: string, id: string) {
    this.assertTenant(companyId);
    const existing = await this.findById(companyId, userId, id);
    const updated = await this.prisma.savedFilter.update({
      where: { id },
      data: { isPinned: !existing.isPinned },
    });
    return updated;
  }

  private validateFilterJson(input: unknown): SavedFilterJson {
    const parsed = FilterJsonSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid filterJson: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
      );
    }
    return parsed.data;
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  private async audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'SAVED_FILTER',
          resourceId,
          newValues: metadata as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
}
