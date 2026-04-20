// =============================================
// 📥 DataImportController (Session 54 — Feature A1)
// =============================================
// Endpoint to enqueue contact bulk import via CSV.
//
// POST /data-import/contacts
//   body: { csvContent: string }
//   guards: TenantGuard + RolesGuard (OWNER/ADMIN/MANAGER)
//   returns: { jobId, status }

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import {
  CompanyId,
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { DataImportService } from './data-import.service';
import { ImportContactsDto } from './dto/import-contacts.dto';

@ApiTags('data-import')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('data-import')
export class DataImportController {
  constructor(private readonly service: DataImportService) {}

  @Post('contacts')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enqueue a contacts CSV bulk import' })
  async enqueueContacts(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportContactsDto,
  ) {
    const job = await this.service.enqueueContactImport(
      companyId,
      user.id,
      dto.csvContent,
    );
    return { jobId: job.id, status: job.status };
  }
}
