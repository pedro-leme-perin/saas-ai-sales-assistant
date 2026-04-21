// =============================================
// 🧩 CustomFieldsController (Session 55 — Feature A1)
// =============================================

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomFieldResource, UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/upsert-custom-field.dto';

@ApiTags('custom-fields')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'List custom field definitions for this tenant' })
  async list(@CompanyId() companyId: string, @Query('resource') resource?: CustomFieldResource) {
    return { data: await this.service.list(companyId, resource) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one definition' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create custom field definition' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update custom field definition' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete custom field definition' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(companyId, user.id, id);
  }
}
