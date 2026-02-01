import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { CallsService } from '../../src/modules/calls/calls.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

describe('CallsService', () => {
  let service: CallsService;
  let prismaService: PrismaService;

  const mockCall = {
    id: 'call-123',
    companyId: 'company-123',
    userId: 'user-123',
    phoneNumber: '+5511999999999',
    direction: 'OUTBOUND',
    status: 'COMPLETED',
    duration: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    call: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => null),
          },
        },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return array of calls for company', async () => {
      const calls = [mockCall];
      mockPrismaService.call.findMany.mockResolvedValue(calls);

      const result = await service.findAll('company-123');

      expect(result).toEqual(calls);
      expect(mockPrismaService.call.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return empty array when no calls exist', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([]);

      const result = await service.findAll('company-123');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a call by id and companyId', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(mockCall);

      const result = await service.findOne('call-123', 'company-123');

      expect(result).toEqual(mockCall);
      expect(mockPrismaService.call.findFirst).toHaveBeenCalledWith({
        where: { id: 'call-123', companyId: 'company-123' },
      });
    });

    it('should throw NotFoundException when call not found', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('invalid-id', 'company-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new call', async () => {
      const createData = {
        userId: 'user-123',
        phoneNumber: '+5511999999999',
        direction: 'OUTBOUND',
        status: 'INITIATED',
        duration: 0,
      };

      mockPrismaService.call.create.mockResolvedValue({
        ...mockCall,
        ...createData,
      });

      const result = await service.create('company-123', createData);

      expect(result).toBeDefined();
      expect(mockPrismaService.call.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          companyId: 'company-123',
        },
      });
    });
  });

  describe('update', () => {
    it('should update an existing call', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(mockCall);
      mockPrismaService.call.update.mockResolvedValue({
        ...mockCall,
        duration: 200,
      });

      const result = await service.update('call-123', 'company-123', {
        duration: 200,
      });

      expect(result.duration).toBe(200);
    });

    it('should throw NotFoundException when updating non-existent call', async () => {
      mockPrismaService.call.findFirst.mockResolvedValue(null);

      await expect(
        service.update('invalid-id', 'company-123', { duration: 200 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCallStats', () => {
    it('should return correct statistics', async () => {
      const calls = [
        { ...mockCall, status: 'COMPLETED', duration: 100 },
        { ...mockCall, id: 'call-2', status: 'COMPLETED', duration: 200 },
        { ...mockCall, id: 'call-3', status: 'FAILED', duration: 0 },
      ];
      mockPrismaService.call.findMany.mockResolvedValue(calls);

      const result = await service.getCallStats('company-123');

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.avgDuration).toBe(100); // (100+200+0)/3 = 100
      expect(result.successRate).toBe(67); // 2/3 = 66.67% ~ 67%
    });

    it('should handle empty calls', async () => {
      mockPrismaService.call.findMany.mockResolvedValue([]);

      const result = await service.getCallStats('company-123');

      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.avgDuration).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });
});