// =====================================================
// 📤 UPLOAD CONTROLLER — Presigned URL generation
// =====================================================

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
@ApiBearerAuth('JWT')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate presigned upload URL',
    description: 'Returns a presigned URL for direct file upload to R2 (OWNER/ADMIN only)',
  })
  @ApiResponse({ status: 200, description: 'Presigned URL generated' })
  @ApiResponse({ status: 400, description: 'Invalid file type' })
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
