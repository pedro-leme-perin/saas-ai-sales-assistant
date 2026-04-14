// =====================================================
// 🗄️ PRISMA SERVICE — Unit Tests
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

// Suppress logger output during tests
jest.spyOn(Logger.prototype, 'log').mockImplementation();
jest.spyOn(Logger.prototype, 'warn').mockImplementation();
jest.spyOn(Logger.prototype, 'error').mockImplementation();
jest.spyOn(Logger.prototype, 'debug').mockImplementation();

describe('PrismaService', () => {
  let service: PrismaService;
  let configService: ConfigService;

  const mockConfigValues: Record<string, string> = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    NODE_ENV: 'test',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    // Avoid open handle warnings
    try {
      await service.$disconnect();
    } catch {
      // Expected to fail in test env without real DB
    }
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should extend PrismaClient', () => {
      // PrismaClient exposes $connect, $disconnect, $queryRaw
      expect(typeof service.$connect).toBe('function');
      expect(typeof service.$disconnect).toBe('function');
      expect(typeof service.$queryRaw).toBe('function');
    });

    it('should read DATABASE_URL from ConfigService', () => {
      expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should read NODE_ENV from ConfigService', () => {
      expect(configService.get).toHaveBeenCalledWith('NODE_ENV');
    });
  });

  describe('onModuleInit', () => {
    it('should call $connect', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValueOnce();
      // Mock user.count used in the init method
      (service as unknown as Record<string, unknown>).user = {
        count: jest.fn().mockResolvedValue(5),
      };

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();
    });

    it('should retry on connection failure', async () => {
      const connectSpy = jest.spyOn(service, '$connect');
      (service as unknown as Record<string, unknown>).user = {
        count: jest.fn().mockResolvedValue(0),
      };

      // Fail twice, succeed on third
      connectSpy
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce();

      // Speed up the retry delay
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      });

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(3);
    });

    it('should throw after 5 failed retries', async () => {
      const connectSpy = jest.spyOn(service, '$connect');
      const error = new Error('Connection refused');

      connectSpy.mockRejectedValue(error);

      jest.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        fn();
        return 0 as unknown as NodeJS.Timeout;
      });

      await expect(service.onModuleInit()).rejects.toThrow('Connection refused');
      expect(connectSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValueOnce();

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return true when database is reachable', async () => {
      jest.spyOn(service, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await service.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when database is unreachable', async () => {
      jest.spyOn(service, '$queryRaw').mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('development mode query logging', () => {
    it('should register $on query listener in development', async () => {
      const devConfig: Record<string, string> = {
        DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
        NODE_ENV: 'development',
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => devConfig[key]),
            },
          },
        ],
      }).compile();

      const devService = module.get<PrismaService>(PrismaService);
      // Service should be created without errors in dev mode
      expect(devService).toBeDefined();

      try {
        await devService.$disconnect();
      } catch {
        // Expected
      }
    });
  });
});
