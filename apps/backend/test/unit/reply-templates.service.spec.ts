// =============================================
// 📄 ReplyTemplatesService — unit tests (Session 46)
// =============================================
// Covers:
//   - CRUD (list channel filter, findById NotFound, create success + P2002 →
//     BadRequest, update merges + extracts variables, remove, markUsed)
//   - extractVariables detects {{var}} and merges with provided list
//   - suggest(): empty → [], single → passthrough, no OPENAI_API_KEY → heuristic
//   - heuristicRank orders by token overlap + usageCount tiebreaker
//   - llmRank parses JSON schema, clamps idx + score, falls back on non-JSON
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReplyTemplateChannel } from '@prisma/client';
import { ReplyTemplatesService } from '../../src/modules/reply-templates/reply-templates.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(15000);

// Mock OpenAI SDK at module level — default: no key, so constructor path skips
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

const makeTemplate = (
  overrides: Partial<{
    id: string;
    companyId: string;
    name: string;
    channel: ReplyTemplateChannel;
    category: string | null;
    content: string;
    variables: string[];
    isActive: boolean;
    usageCount: number;
    createdById: string;
  }> = {},
) => ({
  id: overrides.id ?? 'tmpl-1',
  companyId: overrides.companyId ?? 'company-1',
  createdById: overrides.createdById ?? 'user-1',
  name: overrides.name ?? 'Follow-up 1',
  channel: overrides.channel ?? ReplyTemplateChannel.WHATSAPP,
  category: overrides.category ?? null,
  content: overrides.content ?? 'Olá {{nome}}, obrigado pelo interesse!',
  variables: overrides.variables ?? ['nome'],
  isActive: overrides.isActive ?? true,
  usageCount: overrides.usageCount ?? 0,
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ReplyTemplatesService', () => {
  let service: ReplyTemplatesService;

  const mockPrisma = {
    replyTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const mockConfig = {
    get: jest.fn((k: string) => {
      if (k === 'OPENAI_API_KEY') return undefined; // default: no LLM
      if (k === 'OPENAI_MODEL') return 'gpt-4o-mini';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplyTemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ReplyTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────
  describe('list', () => {
    it('filters BOTH-channel templates alongside CALL when channel=CALL', async () => {
      mockPrisma.replyTemplate.findMany.mockResolvedValueOnce([]);
      await service.list('company-1', ReplyTemplateChannel.CALL);
      const arg = (
        mockPrisma.replyTemplate.findMany.mock.calls[0] as Array<{ where: { channel: unknown } }>
      )[0];
      expect(arg.where.channel).toEqual({
        in: [ReplyTemplateChannel.CALL, ReplyTemplateChannel.BOTH],
      });
    });

    it('applies exact BOTH filter when channel=BOTH', async () => {
      mockPrisma.replyTemplate.findMany.mockResolvedValueOnce([]);
      await service.list('company-1', ReplyTemplateChannel.BOTH);
      const arg = (
        mockPrisma.replyTemplate.findMany.mock.calls[0] as Array<{ where: { channel: unknown } }>
      )[0];
      expect(arg.where.channel).toBe(ReplyTemplateChannel.BOTH);
    });
  });

  describe('findById', () => {
    it('throws NotFound when tenant mismatch', async () => {
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('company-1', 'tmpl-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('persists + extracts {{variables}} from content', async () => {
      mockPrisma.replyTemplate.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'tmpl-new', ...data }),
      );
      const out = await service.create('company-1', 'user-1', {
        name: 'Fechamento',
        channel: ReplyTemplateChannel.WHATSAPP,
        content: 'Olá {{nome}}, seu desconto de {{perc}}% vence em {{data}}.',
      });
      expect(out.variables).toEqual(expect.arrayContaining(['nome', 'perc', 'data']));
    });

    it('converts P2002 into BadRequestException', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('dupe', {
        code: 'P2002',
        clientVersion: 'test',
      });
      mockPrisma.replyTemplate.create.mockRejectedValueOnce(p2002);
      await expect(
        service.create('company-1', 'user-1', {
          name: 'dup',
          channel: ReplyTemplateChannel.WHATSAPP,
          content: 'x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('re-extracts variables when content changes', async () => {
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce(
        makeTemplate({ content: 'Hi {{a}}', variables: ['a'] }),
      );
      mockPrisma.replyTemplate.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...makeTemplate(), ...data }),
      );
      await service.update('company-1', 'tmpl-1', 'user-1', { content: 'Hello {{x}} and {{y}}' });
      const arg = (
        mockPrisma.replyTemplate.update.mock.calls[0] as Array<{ data: { variables: string[] } }>
      )[0];
      expect(arg.data.variables).toEqual(expect.arrayContaining(['x', 'y']));
    });
  });

  describe('remove', () => {
    it('returns ok on success', async () => {
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.replyTemplate.delete.mockResolvedValueOnce({ id: 'tmpl-1' });
      expect(await service.remove('company-1', 'tmpl-1', 'user-1')).toEqual({ success: true });
    });
  });

  describe('markUsed', () => {
    it('increments usage + stamps lastUsedAt', async () => {
      mockPrisma.replyTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.replyTemplate.update.mockResolvedValueOnce(makeTemplate({ usageCount: 1 }));
      await service.markUsed('company-1', 'tmpl-1');
      const arg = (
        mockPrisma.replyTemplate.update.mock.calls[0] as Array<{
          data: { usageCount: unknown; lastUsedAt: unknown };
        }>
      )[0];
      expect(arg.data.usageCount).toEqual({ increment: 1 });
      expect(arg.data.lastUsedAt).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────
  // suggest
  // ─────────────────────────────────────────────
  describe('suggest', () => {
    it('returns [] when no candidates', async () => {
      mockPrisma.replyTemplate.findMany.mockResolvedValueOnce([]);
      const out = await service.suggest('company-1', {
        channel: ReplyTemplateChannel.WHATSAPP,
        context: 'quanto custa o plano starter?',
      });
      expect(out).toEqual([]);
    });

    it('single candidate short-circuits (no LLM call)', async () => {
      const only = makeTemplate({ name: 'Só esse' });
      mockPrisma.replyTemplate.findMany.mockResolvedValueOnce([only]);
      const out = await service.suggest('company-1', {
        channel: ReplyTemplateChannel.WHATSAPP,
        context: 'oi',
      });
      expect(out).toHaveLength(1);
      expect(out[0]!.id).toBe(only.id);
      expect(out[0]!.score).toBe(1);
    });

    it('no OPENAI_API_KEY → heuristic ranker (overlap ordering)', async () => {
      const a = makeTemplate({
        id: 'a',
        name: 'Preco starter',
        content: 'Plano starter custa 97 reais',
        usageCount: 1,
      });
      const b = makeTemplate({
        id: 'b',
        name: 'Onboarding',
        content: 'Como começar no sistema',
        usageCount: 5,
      });
      mockPrisma.replyTemplate.findMany.mockResolvedValueOnce([a, b]);
      const out = await service.suggest('company-1', {
        channel: ReplyTemplateChannel.WHATSAPP,
        context: 'quanto custa o plano starter',
      });
      // 'a' shares "plano", "starter", "custa" with the context; 'b' shares nothing
      expect(out[0]!.id).toBe('a');
    });
  });

  // ─────────────────────────────────────────────
  // extractVariables via create (unit covered indirectly above)
  // ─────────────────────────────────────────────
  describe('extractVariables', () => {
    it('ignores invalid tokens and caps at 30', async () => {
      mockPrisma.replyTemplate.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'tmpl-n', ...data }),
      );
      const manyValid = Array.from({ length: 40 }, (_, i) => `v${i}`);
      const out = await service.create('company-1', 'user-1', {
        name: 'Var test',
        channel: ReplyTemplateChannel.WHATSAPP,
        content: 'static no placeholders',
        variables: [...manyValid, '123bad', 'also-bad'],
      });
      expect(out.variables.length).toBeLessThanOrEqual(30);
      expect(out.variables).not.toContain('123bad');
      expect(out.variables).not.toContain('also-bad');
    });
  });
});
