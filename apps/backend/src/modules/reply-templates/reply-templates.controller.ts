// =============================================
// 📄 REPLY TEMPLATES CONTROLLER (Session 46)
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
import { ReplyTemplateChannel, UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ReplyTemplatesService } from './reply-templates.service';
import { CreateReplyTemplateDto } from './dto/create-reply-template.dto';
import { UpdateReplyTemplateDto } from './dto/update-reply-template.dto';
import { SuggestReplyTemplateDto } from './dto/suggest-reply-template.dto';

@ApiTags('reply-templates')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('reply-templates')
export class ReplyTemplatesController {
  constructor(private readonly service: ReplyTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List reply templates for the current company' })
  async list(
    @CompanyId() companyId: string,
    @Query('channel') channel?: ReplyTemplateChannel,
    @Query('category') category?: string,
  ) {
    return { data: await this.service.list(companyId, channel, category) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single reply template' })
  async findById(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new reply template' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReplyTemplateDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a reply template' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReplyTemplateDto,
  ) {
    return this.service.update(companyId, id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a reply template' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(companyId, id, user.id);
  }

  @Post(':id/used')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a template as used (increments usageCount)' })
  async markUsed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
  ) {
    return this.service.markUsed(companyId, id);
  }

  @Post('suggest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suggest top-k templates for a given conversation context' })
  async suggest(
    @CompanyId() companyId: string,
    @Body() dto: SuggestReplyTemplateDto,
  ) {
    return { data: await this.service.suggest(companyId, dto) };
  }
}
