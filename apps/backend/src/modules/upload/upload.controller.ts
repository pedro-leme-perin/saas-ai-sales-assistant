// =====================================================
// 📤 UPLOAD CONTROLLER — Presigned URL generation
// =====================================================

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';
import { UploadService } from './upload.service';
import { AuthGuard } from '@modules/auth/guards/auth.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

class GenerateUploadUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsIn(['logos', 'avatars', 'attachments'])
  category!: 'logos' | 'avatars' | 'attachments';
}

interface CurrentUserPayload {
  id: string;
  companyId: string;
  email: string;
  role: string;
}

@ApiTags('upload')
@Controller('upload')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Throttle({ strict: { ttl: 60000, limit: 10 } }) // File uploads — strict rate limit
@ApiBearerAuth('JWT')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate presigned upload URL',
    description:
      'Generates a presigned URL for direct file upload to Cloudflare R2 object storage. ' +
      'Only OWNER and ADMIN roles can generate upload URLs. Files are organized by category ' +
      '(logos, avatars, attachments) under the company namespace. The returned URL expires ' +
      'after a short TTL and supports a single PUT request.',
  })
  @ApiBody({
    description: 'File metadata for presigned URL generation',
    schema: {
      type: 'object',
      required: ['fileName', 'contentType', 'category'],
      properties: {
        fileName: {
          type: 'string',
          example: 'company-logo.png',
          description: 'Original file name',
        },
        contentType: {
          type: 'string',
          example: 'image/png',
          description: 'MIME type of the file',
        },
        category: {
          type: 'string',
          enum: ['logos', 'avatars', 'attachments'],
          example: 'logos',
          description: 'Storage category for file organization',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            uploadUrl: {
              type: 'string',
              example: 'https://uploads.theiadvisor.com/...',
              description: 'Presigned PUT URL for direct upload',
            },
            fileUrl: {
              type: 'string',
              example: 'https://uploads.theiadvisor.com/logos/abc123.png',
              description: 'Public URL of the file after upload',
            },
            expiresIn: {
              type: 'number',
              example: 3600,
              description: 'URL expiration time in seconds',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or missing required fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized -- missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden -- requires OWNER or ADMIN role' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (strict tier)' })
  async generatePresignedUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateUploadUrlDto,
  ) {
    const result = await this.uploadService.generatePresignedUrl({
      companyId: user.companyId,
      fileName: dto.fileName,
      contentType: dto.contentType,
      category: dto.category,
    });

    return { success: true, data: result };
  }
}
