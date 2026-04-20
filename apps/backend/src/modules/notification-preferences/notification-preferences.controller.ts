// =============================================
// 📄 NOTIFICATION PREFERENCES CONTROLLER (Session 48)
// =============================================

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpsertPreferencesDto } from './dto/upsert-preference.dto';

@ApiTags('notification-preferences')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('users/me/notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'List notification preferences for the current user' })
  async list(@CurrentUser() user: AuthenticatedUser, @CompanyId() companyId: string) {
    return { data: await this.service.list(user.id, companyId) };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk upsert notification preferences' })
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @CompanyId() companyId: string,
    @Body() dto: UpsertPreferencesDto,
  ) {
    return this.service.upsertMany(user.id, companyId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset to defaults (deletes all explicit prefs)' })
  async reset(@CurrentUser() user: AuthenticatedUser, @CompanyId() companyId: string) {
    return this.service.reset(user.id, companyId);
  }
}
