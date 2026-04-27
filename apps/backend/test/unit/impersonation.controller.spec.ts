import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ImpersonationController } from '../../src/modules/impersonation/impersonation.controller';
import { ImpersonationService } from '../../src/modules/impersonation/impersonation.service';
import type { AuthenticatedUser } from '../../src/common/decorators';
import type { StartImpersonationDto } from '../../src/modules/impersonation/dto/start-impersonation.dto';

jest.setTimeout(15000);

describe('ImpersonationController', () => {
  let controller: ImpersonationController;
  let service: jest.Mocked<Partial<ImpersonationService>>;

  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440090';
  const USER_ID = '660e8400-e29b-41d4-a716-446655440091';
  const TARGET_USER_ID = '770e8400-e29b-41d4-a716-446655440092';
  const SESSION_ID = '880e8400-e29b-41d4-a716-446655440093';

  const mockUser: AuthenticatedUser = {
    id: USER_ID,
    clerkId: 'user_clerk_imp',
    email: 'admin@tenant.com',
    name: 'Test Admin',
    role: UserRole.ADMIN,
    companyId: COMPANY_ID,
    permissions: [],
  };

  const mockSession = {
    id: SESSION_ID,
    companyId: COMPANY_ID,
    actorUserId: USER_ID,
    targetUserId: TARGET_USER_ID,
    isActive: true,
    expiresAt: new Date('2026-12-31'),
  };

  const buildReq = (overrides: Partial<Request> = {}): Request =>
    ({
      headers: {},
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' } as Request['socket'],
      ...overrides,
    }) as Request;

  beforeEach(async () => {
    service = {
      start: jest.fn().mockResolvedValue({ ...mockSession, plaintextToken: 'imp_REDACTED' }),
      end: jest.fn().mockResolvedValue({ endedAt: new Date() }),
      listActive: jest.fn().mockResolvedValue([mockSession]),
      findById: jest.fn().mockResolvedValue(mockSession),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImpersonationController],
      providers: [{ provide: ImpersonationService, useValue: service }],
    }).compile();

    controller = module.get<ImpersonationController>(ImpersonationController);
  });

  describe('start', () => {
    it('extracts IP from x-forwarded-for header (string form)', async () => {
      const req = buildReq({
        headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.5', 'user-agent': 'Mozilla/5.0' },
      });
      const dto = { targetUserId: TARGET_USER_ID, durationMinutes: 60 };

      const result = await controller.start(
        COMPANY_ID,
        mockUser,
        dto as unknown as StartImpersonationDto,
        req,
      );
      expect(result.id).toBe(SESSION_ID);
      expect(service.start).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        dto,
        { ipAddress: '198.51.100.1', userAgent: 'Mozilla/5.0' },
      );
    });

    it('extracts IP from x-forwarded-for array form', async () => {
      const req = buildReq({
        headers: { 'x-forwarded-for': ['198.51.100.2', '203.0.113.5'] },
      });
      const dto = { targetUserId: TARGET_USER_ID, durationMinutes: 30 };

      await controller.start(COMPANY_ID, mockUser, dto as unknown as StartImpersonationDto, req);
      expect(service.start).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        dto,
        { ipAddress: '198.51.100.2', userAgent: undefined },
      );
    });

    it('falls back to req.ip when no x-forwarded-for', async () => {
      const req = buildReq({ headers: { 'user-agent': 'curl/7.0' } });
      const dto = { targetUserId: TARGET_USER_ID, durationMinutes: 60 };

      await controller.start(COMPANY_ID, mockUser, dto as unknown as StartImpersonationDto, req);
      expect(service.start).toHaveBeenCalledWith(
        COMPANY_ID,
        { id: USER_ID, role: UserRole.ADMIN },
        dto,
        { ipAddress: '203.0.113.10', userAgent: 'curl/7.0' },
      );
    });

    it('truncates very long user-agent to 500 chars', async () => {
      const longUa = 'A'.repeat(800);
      const req = buildReq({ headers: { 'user-agent': longUa } });
      const dto = { targetUserId: TARGET_USER_ID };

      await controller.start(COMPANY_ID, mockUser, dto as unknown as StartImpersonationDto, req);
      const call = service.start!.mock.calls[0];
      expect((call[3] as { userAgent?: string }).userAgent).toHaveLength(500);
    });
  });

  describe('end', () => {
    it('ends session with reason', async () => {
      const result = await controller.end(COMPANY_ID, mockUser, SESSION_ID, 'investigation done');
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(service.end).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
        SESSION_ID,
        'investigation done',
      );
    });

    it('handles missing reason', async () => {
      await controller.end(COMPANY_ID, mockUser, SESSION_ID);
      expect(service.end).toHaveBeenCalledWith(COMPANY_ID, USER_ID, SESSION_ID, undefined);
    });
  });

  describe('listActive', () => {
    it('lists active sessions optionally filtered by actor', async () => {
      const result = await controller.listActive(COMPANY_ID, USER_ID);
      expect(result).toHaveLength(1);
      expect(service.listActive).toHaveBeenCalledWith(COMPANY_ID, USER_ID);
    });

    it('lists all active when no actor filter', async () => {
      await controller.listActive(COMPANY_ID);
      expect(service.listActive).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });
  });

  describe('findById', () => {
    it('returns session detail', async () => {
      const result = await controller.findById(COMPANY_ID, SESSION_ID);
      expect(result).toEqual(mockSession);
      expect(service.findById).toHaveBeenCalledWith(COMPANY_ID, SESSION_ID);
    });
  });
});
