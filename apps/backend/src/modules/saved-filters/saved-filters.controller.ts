// =============================================
// 📄 SAVED FILTERS CONTROLLER (Session 48)
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
import { FilterResource } from '@prisma/client';
import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@ApiTags('saved-filters')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('saved-filters')
export class SavedFiltersController {
  constructor(private readonly service: SavedFiltersService) {}

  @Get()
  @ApiOperation({ summary: 'List saved filters (own + shared)' })
  async list(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('resource') resource?: FilterResource,
  ) {
    return { data: await this.service.list(companyId, user.id, resource) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a saved filter' })
  async findById(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a saved filter' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedFilterDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved filter' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedFilterDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Post(':id/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle pinned state' })
  async pin(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.togglePin(companyId, user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a saved filter' })
  async remove(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(companyId, user.id, id);
  }
}
