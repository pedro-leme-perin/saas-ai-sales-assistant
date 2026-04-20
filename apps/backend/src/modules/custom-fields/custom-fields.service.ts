// =============================================
// 🧩 CustomFieldsService (Session 55 — Feature A1)
// =============================================
// Per-tenant extensible schema registry for domain resources (CONTACT only
// for now). Definitions live in `CustomFieldDefinition`; values live on
// `Contact.customFields` (Json). The service exposes a `validateAndCoerce`
// helper consumed by ContactsService during create/update so bad/missing
// values never reach persistence.
//
// Validation rules per type:
//   TEXT     — string, max 1000 chars
//   NUMBER   — finite number (accepts int/float)
//   BOOLEAN  — strict boolean
//   DATE     — ISO-8601 date or datetime; coerced to YYYY-MM-DD
//   SELECT   — must be member of `options`
// Required fields error on missing value (ignored for inactive definitions).
// Unknown keys are stripped (defense in depth).

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  CustomFieldDefinition,
  CustomFieldResource,
  CustomFieldType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';

import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
} from './dto/upsert-custom-field.dto';

const MAX_DEFS_PER_RESOURCE = 100;
const MAX_TEXT_LEN = 1000;

type FieldValue = string | number | boolean | null;

@Injectable()
export class CustomFieldsService {
  private readonly logger = new Logger(CustomFieldsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== CRUD ===========================================================

  async list(
    companyId: string,
    resource?: CustomFieldResource,
  ): Promise<CustomFieldDefinition[]> {
    return this.prisma.customFieldDefinition.findMany({
      where: {
        companyId,
        ...(resource ? { resource } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: MAX_DEFS_PER_RESOURCE * 5,
    });
  }

  async findById(companyId: string, id: string): Promise<CustomFieldDefinition> {
    const def = await this.prisma.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!def) throw new NotFoundException('custom field definition not found');
    return def;
  }

  async create(
    companyId: string,
    actorId: string,
    dto: CreateCustomFieldDto,
  ): Promise<CustomFieldDefinition> {
    if (dto.type === CustomFieldType.SELECT && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('SELECT fields require at least one option');
    }

    // Enforce per-tenant+resource definition cap (bulkhead).
    const count = await this.prisma.customFieldDefinition.count({
      where: { companyId, resource: dto.resource },
    });
    if (count >= MAX_DEFS_PER_RESOURCE) {
      throw new BadRequestException(
        `too many custom fields for ${dto.resource} (max ${MAX_DEFS_PER_RESOURCE})`,
      );
    }

    try {
      const created = await this.prisma.customFieldDefinition.create({
        data: {
          companyId,
          resource: dto.resource,
          key: dto.key,
          label: dto.label,
          type: dto.type,
          required: dto.required ?? false,
          options: dto.options ?? [],
          isActive: dto.isActive ?? true,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
      void this.audit(companyId, actorId, AuditAction.CREATE, created.id, {
        newValues: { key: created.key, type: created.type, resource: created.resource },
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`custom field key already exists for ${dto.resource}`);
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDefinition> {
    const existing = await this.findById(companyId, id);

    const data: Prisma.CustomFieldDefinitionUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    if (
      existing.type === CustomFieldType.SELECT &&
      dto.options !== undefined &&
      dto.options.length === 0
    ) {
      throw new BadRequestException('SELECT fields require at least one option');
    }

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data,
    });

    void this.audit(companyId, actorId, AuditAction.UPDATE, id, {
      oldValues: this.slim(existing),
      newValues: this.slim(updated),
    });

    return updated;
  }

  async remove(companyId: string, actorId: string, id: string): Promise<void> {
    const existing = await this.findById(companyId, id);
    await this.prisma.customFieldDefinition.delete({ where: { id } });
    void this.audit(companyId, actorId, AuditAction.DELETE, id, {
      oldValues: this.slim(existing),
    });
  }

  // ===== Validation =====================================================

  /**
   * Validates a raw input map against the tenant's active definitions and
   * returns a cleaned `Record<key, value>` safe to persist on the parent.
   * Inactive definitions are skipped (fields stay on the row but aren't
   * enforced). Unknown keys are dropped.
   */
  async validateAndCoerce(
    companyId: string,
    resource: CustomFieldResource,
    input: Record<string, unknown> | undefined,
  ): Promise<Record<string, FieldValue>> {
    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { companyId, resource, isActive: true },
      take: MAX_DEFS_PER_RESOURCE,
    });

    const result: Record<string, FieldValue> = {};
    const source = input && typeof input === 'object' ? input : {};

    for (const def of defs) {
      const raw = source[def.key];
      const missing = raw === undefined || raw === null || raw === '';

      if (missing) {
        if (def.required) {
          throw new BadRequestException(`custom field "${def.key}" is required`);
        }
        continue;
      }

      result[def.key] = this.coerce(def, raw);
    }

    return result;
  }

  private coerce(def: CustomFieldDefinition, raw: unknown): FieldValue {
    switch (def.type) {
      case CustomFieldType.TEXT: {
        const s = String(raw);
        if (s.length > MAX_TEXT_LEN) {
          throw new BadRequestException(`custom field "${def.key}" exceeds ${MAX_TEXT_LEN} chars`);
        }
        return s;
      }
      case CustomFieldType.NUMBER: {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`custom field "${def.key}" must be a number`);
        }
        return n;
      }
      case CustomFieldType.BOOLEAN: {
        if (raw === true || raw === false) return raw;
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        throw new BadRequestException(`custom field "${def.key}" must be a boolean`);
      }
      case CustomFieldType.DATE: {
        const s = String(raw);
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException(`custom field "${def.key}" must be a valid date`);
        }
        return d.toISOString().slice(0, 10);
      }
      case CustomFieldType.SELECT: {
        const s = String(raw);
        if (!def.options.includes(s)) {
          throw new BadRequestException(
            `custom field "${def.key}" must be one of: ${def.options.join(', ')}`,
          );
        }
        return s;
      }
      default:
        return String(raw);
    }
  }

  // ===== Helpers ========================================================

  private slim(def: CustomFieldDefinition) {
    return {
      key: def.key,
      label: def.label,
      type: def.type,
      required: def.required,
      options: def.options,
      isActive: def.isActive,
      displayOrder: def.displayOrder,
    };
  }

  private async audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    values: { oldValues?: unknown; newValues?: unknown },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'CUSTOM_FIELD',
          resourceId,
          oldValues: (values.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
          newValues: (values.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log failed for ${action} ${resourceId}`, err as Error);
    }
  }
}
