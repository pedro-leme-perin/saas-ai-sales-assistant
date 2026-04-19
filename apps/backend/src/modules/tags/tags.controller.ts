// =============================================
// 📄 TAGS CONTROLLER (Session 47)
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
import { UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { AttachTagsDto } from './dto/attach-tags.dto';
import { SearchConversationsDto } from './dto/search-conversations.dto';

@ApiTags('tags')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller()
export class TagsController {
  constructor(private readonly service: TagsService) {}

  // ───────── CRUD ─────────
  @Get('tags')
  @ApiOperation({ summary: 'List all tags for the current tenant' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.service.list(companyId) };
  }

  @Get('tags/:id')
  @ApiOperation({ summary: 'Get a tag by id' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(companyId, id);
  }

  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a tag' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTagDto,
  ) {
    return this.service.create(companyId, user.id, dto);
  }

  @Patch('tags/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a tag' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTagDto,
  ) {
    return this.service.update(companyId, id, user.id, dto);
  }

  @Delete('tags/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a tag (also detaches from all conversations)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(companyId, id, user.id);
  }

  // ───────── ATTACH / DETACH — CALLS ─────────
  @Get('calls/:id/tags')
  @ApiOperation({ summary: 'List tags attached to a call' })
  async listCallTags(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.service.listCallTags(companyId, id) };
  }

  @Post('calls/:id/tags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach one or more tags to a call' })
  async attachCall(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachTagsDto,
  ) {
    return this.service.attachToCall(companyId, id, dto.tagIds, user.id);
  }

  @Delete('calls/:id/tags/:tagId')
  @ApiOperation({ summary: 'Detach a tag from a call' })
  async detachCall(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('tagId', new ParseUUIDPipe()) tagId: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.detachFromCall(companyId, id, tagId, user.id);
  }

  // ───────── ATTACH / DETACH — CHATS ─────────
  @Get('whatsapp/chats/:id/tags')
  @ApiOperation({ summary: 'List tags attached to a chat' })
  async listChatTags(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.service.listChatTags(companyId, id) };
  }

  @Post('whatsapp/chats/:id/tags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach one or more tags to a chat' })
  async attachChat(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachTagsDto,
  ) {
    return this.service.attachToChat(companyId, id, dto.tagIds, user.id);
  }

  @Delete('whatsapp/chats/:id/tags/:tagId')
  @ApiOperation({ summary: 'Detach a tag from a chat' })
  async detachChat(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('tagId', new ParseUUIDPipe()) tagId: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.detachFromChat(companyId, id, tagId, user.id);
  }

  // ───────── SEARCH ─────────
  @Get('search/conversations')
  @ApiOperation({ summary: 'Full-text search across calls and chats with optional tag filter' })
  async search(@CompanyId() companyId: string, @Query() dto: SearchConversationsDto) {
    return this.service.search(companyId, dto);
  }
}
