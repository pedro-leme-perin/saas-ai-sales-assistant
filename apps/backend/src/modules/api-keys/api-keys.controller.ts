// =============================================
// 📄 API KEYS CONTROLLER (Session 47)
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys for the current tenant' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.service.list(companyId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single API key metadata (never plaintext)' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new API key. Response contains the plaintext key exactly once.',
  })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an API key (name/scopes/isActive/rate limit/expiresAt)' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.service.update(companyId, id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key (soft delete — key stops working)' })
  async revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revoke(companyId, id, user.id);
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the secret. Response contains the new plaintext key exactly once.',
  })
  async rotate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.rotate(companyId, id, user.id);
  }
}
