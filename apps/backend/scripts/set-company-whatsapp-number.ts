#!/usr/bin/env tsx
/**
 * set-company-whatsapp-number.ts — sets `Company.whatsappPhoneNumberId` for a tenant.
 *
 * Why this script exists
 * ---------------------
 * `WhatsappService.processWebhook` resolves the tenant of an inbound message through
 * `findCompanyByWhatsAppNumber(toNumber)`, which looks up `Company.whatsappPhoneNumberId`.
 * With no match the message is dropped and only a `logger.warn` is emitted — the symptom is
 * silence, not an error.
 *
 * The field is read in `whatsapp.service.ts:454` and `onboarding.service.ts:47,60`, and is
 * never written anywhere in `apps/`: no endpoint, no DTO, no screen. Until that gap is closed
 * in the product (registered debt, S85), this script is the only supported way to populate it.
 *
 * Stored format
 * -------------
 * `extractPhone()` (`whatsapp.service.ts:626`) strips the `whatsapp:` prefix from the Twilio
 * payload BEFORE the lookup, so the column must hold bare E.164 — `+14155238886`, never
 * `whatsapp:+14155238886`. The latter is the shape of `TWILIO_WHATSAPP_NUMBER` and is
 * rejected here on purpose: storing it would make every inbound message miss its tenant.
 *
 * Usage:
 *   pnpm --filter @saas/backend exec tsx scripts/set-company-whatsapp-number.ts \
 *     --number "+14155238886" [--company-id <uuid>] [--force] [--dry-run]
 *
 * Options:
 *   --number <e164>     (required) Bare E.164 number, e.g. +14155238886
 *   --company-id <uuid> Target company. Auto-resolved when exactly one live company exists.
 *   --force             Allow overwriting a different, already-populated value
 *   --dry-run           Run every validation, write nothing
 *
 * Exit codes:
 *   0 — success (written, or already correct)
 *   1 — any failure: bad argument, ambiguous tenant, conflict, DB error
 *
 * References:
 *   Clean Code Cap. 3 — one level of abstraction per function
 *   Release It! — Fail Fast: every validation runs before the transaction opens
 */

import { PrismaClient, Prisma, type Company } from '@prisma/client';

// =============================================
// Types
// =============================================

export interface CliArgs {
  number: string;
  companyId?: string;
  force: boolean;
  dryRun: boolean;
}

/** Minimal shape this script needs from a Company row. */
export interface CompanyRow {
  id: string;
  name: string;
  whatsappPhoneNumberId: string | null;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Thrown for every expected failure. Distinguishes operator error from a crash. */
export class ScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptError';
  }
}

// =============================================
// Pure rules (unit-tested — see test/unit/set-company-whatsapp-number.spec.ts)
// =============================================

/**
 * Bare E.164: `+`, a non-zero country digit, then 7 to 14 more digits.
 * Deliberately narrower than "anything Twilio might send" — see the header note on
 * the `whatsapp:` prefix.
 */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function validateE164(raw: string): ValidationResult {
  if (raw.trim() !== raw) {
    return { ok: false, reason: 'number has leading or trailing whitespace' };
  }
  if (raw.startsWith('whatsapp:')) {
    return {
      ok: false,
      reason:
        `"${raw}" carries the "whatsapp:" prefix. That is the shape of TWILIO_WHATSAPP_NUMBER, ` +
        'not the shape this column must hold: extractPhone() strips the prefix before the ' +
        `tenant lookup, so store the bare number ("${raw.slice('whatsapp:'.length)}").`,
    };
  }
  if (!raw.startsWith('+')) {
    return { ok: false, reason: `"${raw}" must start with "+" (E.164)` };
  }
  if (!E164_PATTERN.test(raw)) {
    return {
      ok: false,
      reason: `"${raw}" is not valid E.164 (expected + followed by 8 to 15 digits, first digit not 0)`,
    };
  }
  return { ok: true };
}

/**
 * A number may belong to at most one tenant: the lookup is a `findFirst` on an unindexed,
 * non-unique column, so two rows sharing a number would route messages by row order.
 */
export function checkUniqueness(
  targetCompanyId: string,
  holders: readonly CompanyRow[],
): ValidationResult {
  const others = holders.filter((c) => c.id !== targetCompanyId);
  if (others.length === 0) return { ok: true };
  const list = others.map((c) => `${c.id} (${c.name})`).join(', ');
  return {
    ok: false,
    reason: `number already assigned to another company: ${list}`,
  };
}

/** Decides whether the write may proceed, given the current value. */
export function checkOverwrite(
  current: string | null,
  requested: string,
  force: boolean,
): ValidationResult | { ok: true; noop: true } {
  if (current === requested) return { ok: true, noop: true };
  if (current === null || current === '') return { ok: true };
  if (force) return { ok: true };
  return {
    ok: false,
    reason:
      `company already has "${current}", which differs from the requested "${requested}". ` +
      'Re-run with --force to overwrite.',
  };
}

// =============================================
// Argument parsing
// =============================================

export function parseArgs(argv: readonly string[]): CliArgs {
  let numberArg: string | undefined;
  let companyId: string | undefined;
  let force = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--number':
        numberArg = argv[++i];
        break;
      case '--company-id':
        companyId = argv[++i];
        break;
      case '--force':
        force = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        throw new ScriptError(`unknown argument: ${arg}`);
    }
  }

  if (!numberArg) throw new ScriptError('--number is required');
  if (companyId !== undefined && companyId.trim() === '') {
    throw new ScriptError('--company-id was given but is empty');
  }

  return { number: numberArg, companyId, force, dryRun };
}

// =============================================
// Database steps
// =============================================

const COMPANY_SELECT = { id: true, name: true, whatsappPhoneNumberId: true } as const;

async function resolveCompany(prisma: PrismaClient, companyId?: string): Promise<CompanyRow> {
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: COMPANY_SELECT,
    });
    if (!company) {
      throw new ScriptError(`no live company with id ${companyId} (deleted companies are ignored)`);
    }
    return company;
  }

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: COMPANY_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    throw new ScriptError('no live company found');
  }
  if (companies.length > 1) {
    const list = companies.map((c) => `  ${c.id}  ${c.name}`).join('\n');
    throw new ScriptError(
      `--company-id is required: ${companies.length} live companies exist\n${list}`,
    );
  }
  return companies[0];
}

function describe(company: CompanyRow): string {
  return (
    `id=${company.id} name=${JSON.stringify(company.name)} ` +
    `whatsappPhoneNumberId=${company.whatsappPhoneNumberId === null ? 'null' : JSON.stringify(company.whatsappPhoneNumberId)}`
  );
}

// =============================================
// Main
// =============================================

export async function run(argv: readonly string[], prisma: PrismaClient): Promise<number> {
  const args = parseArgs(argv);

  const e164 = validateE164(args.number);
  if (!e164.ok) throw new ScriptError(`invalid --number: ${e164.reason}`);

  const company = await resolveCompany(prisma, args.companyId);
  console.log(`[BEFORE] ${describe(company)}`);

  const holders = await prisma.company.findMany({
    where: { whatsappPhoneNumberId: args.number },
    select: COMPANY_SELECT,
  });
  const unique = checkUniqueness(company.id, holders);
  if (!unique.ok) throw new ScriptError(unique.reason);

  const overwrite = checkOverwrite(company.whatsappPhoneNumberId, args.number, args.force);
  if (!overwrite.ok) throw new ScriptError(overwrite.reason);

  if ('noop' in overwrite) {
    console.log(`[NO-OP]  already set to ${JSON.stringify(args.number)}; nothing to write`);
    console.log(`[AFTER]  ${describe(company)}`);
    return 0;
  }

  if (args.dryRun) {
    console.log(
      `[DRY-RUN] would set whatsappPhoneNumberId to ${JSON.stringify(args.number)} ` +
        `(was ${company.whatsappPhoneNumberId === null ? 'null' : JSON.stringify(company.whatsappPhoneNumberId)})`,
    );
    console.log('[DRY-RUN] all validations passed; no write performed');
    console.log(`[AFTER]  ${describe(company)} (unchanged)`);
    return 0;
  }

  const updated: Company = await prisma.$transaction(async (tx) => {
    const row = await tx.company.update({
      where: { id: company.id },
      data: { whatsappPhoneNumberId: args.number },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        action: 'UPDATE',
        resource: 'COMPANY',
        resourceId: company.id,
        description: 'whatsappPhoneNumberId set via scripts/set-company-whatsapp-number.ts',
        oldValues: {
          whatsappPhoneNumberId: company.whatsappPhoneNumberId,
        } as unknown as Prisma.InputJsonValue,
        newValues: { whatsappPhoneNumberId: args.number } as unknown as Prisma.InputJsonValue,
      },
    });

    return row;
  });

  console.log(
    `[AFTER]  ${describe({
      id: updated.id,
      name: updated.name,
      whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
    })}`,
  );
  return 0;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const code = await run(process.argv.slice(2), prisma);
    process.exitCode = code;
  } catch (err: unknown) {
    if (err instanceof ScriptError) {
      console.error(`[ERROR] ${err.message}`);
    } else {
      console.error(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Guarded so the pure rules above can be imported by the unit spec without connecting to a DB.
if (require.main === module) {
  void main();
}
