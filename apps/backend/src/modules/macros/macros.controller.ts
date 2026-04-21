// =============================================
// 🛠 MACROS CONTROLLER (Session 56)
// =============================================

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, Roles, UserId } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { CreateMacroDto } from './dto/create-macro.dto';
import { ExecuteMacroDto } from './dto/execute-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';
import { MacrosService } from './macros.service';

@ApiTags('macros')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('macros')
export class MacrosController {
  constructor(private readonly service: MacrosService) {}

  @Get()
  @ApiOperation({ summary: 'List macros for the current tenant' })
  async list(@CompanyId() companyId: string) {
    return this.service.list(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a macro by id' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a macro' })
  async create(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Body() dto: CreateMacroDto,
  ) {
    return this.service.create(companyId, userId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a macro' })
  async update(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMacroDto,
  ) {
    return this.service.update(companyId, id, userId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a macro' })
  async remove(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(companyId, id, userId);
  }

  @Post(':id/execute')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Execute a macro against a chat' })
  async execute(
    @CompanyId() companyId: string,
    @UserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExecuteMacroDto,
  ) {
    return this.service.execute(companyId, userId, id, dto.chatId);
  }
}
