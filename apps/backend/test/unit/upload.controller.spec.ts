// =====================================================
// 📤 UPLOAD CONTROLLER — Unit Tests
// =====================================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from '../../src/modules/upload/upload.controller';
import { UploadService } from '../../src/modules/upload/upload.service';
import { Reflector } from '@nestjs/core';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: UploadService;

  const mockUser = {
    id: 'user-uuid-123',
    companyId: 'company-uuid-456',
    email: 'admin@empresa.com',
    role: 'ADMIN',
  };

  const mockPresignedResult = {
    uploadUrl: 'https://account.r2.cloudflarestorage.com/bucket/logos/key.png?signed=true',
    publicUrl: 'https://cdn.salesai.com.br/logos/key.png',
    key: 'logos/company-uuid-456/1234_abc.png',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    const mockUploadService = {
      generatePresignedUrl: jest.fn().mockResolvedValue(mockPresignedResult),
      isValidUploadUrl: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePresignedUrl', () => {
    it('should return presigned URL for valid request', async () => {
      const dto = {
        fileName: 'logo.png',
        contentType: 'image/png',
        category: 'logos' as const,
      };

      const result = await controller.generatePresignedUrl(mockUser, dto);

      expect(result).toEqual({
        success: true,
        data: mockPresignedResult,
      });
    });

    it('should pass companyId from user to service', async () => {
      const dto = {
        fileName: 'logo.png',
        contentType: 'image/png',
        category: 'logos' as const,
      };

      await controller.generatePresignedUrl(mockUser, dto);

      expect(uploadService.generatePresignedUrl).toHaveBeenCalledWith({
        companyId: 'company-uuid-456',
        fileName: 'logo.png',
        contentType: 'image/png',
        category: 'logos',
      });
    });

    it('should pass avatars category', async () => {
      const dto = {
        fileName: 'avatar.jpg',
        contentType: 'image/jpeg',
        category: 'avatars' as const,
      };

      await controller.generatePresignedUrl(mockUser, dto);

      expect(uploadService.generatePresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'avatars' }),
      );
    });

    it('should pass attachments category', async () => {
      const dto = {
        fileName: 'doc.png',
        contentType: 'image/png',
        category: 'attachments' as const,
      };

      await controller.generatePresignedUrl(mockUser, dto);

      expect(uploadService.generatePresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'attachments' }),
      );
    });

    it('should propagate service errors', async () => {
      (uploadService.generatePresignedUrl as jest.Mock).mockRejectedValueOnce(
        new BadRequestException('Invalid content type'),
      );

      const dto = {
        fileName: 'file.exe',
        contentType: 'application/exe',
        category: 'logos' as const,
      };

      await expect(controller.generatePresignedUrl(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle different users/companies', async () => {
      const differentUser = {
        id: 'user-uuid-789',
        companyId: 'company-uuid-999',
        email: 'owner@outra.com',
        role: 'OWNER',
      };

      const dto = {
        fileName: 'logo.webp',
        contentType: 'image/webp',
        category: 'logos' as const,
      };

      await controller.generatePresignedUrl(differentUser, dto);

      expect(uploadService.generatePresignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'company-uuid-999' }),
      );
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have generatePresignedUrl method', () => {
      expect(controller.generatePresignedUrl).toBeDefined();
      expect(typeof controller.generatePresignedUrl).toBe('function');
    });
  });
});
