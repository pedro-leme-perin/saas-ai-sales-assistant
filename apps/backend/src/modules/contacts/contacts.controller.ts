// =============================================
// 📄 CONTACTS CONTROLLER (Session 50)
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
import { ContactsService } from './contacts.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { MergeContactsDto } from './dto/merge-contacts.dto';

@ApiTags('contacts')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts (search by name/phone/email, paginated)' })
  async list(
    @CompanyId() companyId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.service.list(companyId, {
      q,
      limit: Number.isFinite(parsed) ? parsed : undefined,
      cursor,
    });
  }

  @Post('merge')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merge two contacts (moves notes + csat, sums counters)' })
  async merge(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MergeContactsDto,
  ) {
    return this.service.merge(companyId, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by id' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(companyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update editable fields of a contact' })
  async update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.service.update(companyId, user.id, id, dto);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Unified timeline: calls + chats + notes, desc, capped at 200' })
  async timeline(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { data: await this.service.timeline(companyId, id) };
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'List internal notes for a contact' })
  async listNotes(
    @CompanyId() companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { data: await this.service.listNotes(companyId, id) };
  }

  @Post(':id/notes')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Add a note to a contact' })
  async addNote(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.service.addNote(companyId, user.id, id, dto.content);
  }

  @Delete(':id/notes/:noteId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a note' })
  async removeNote(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('noteId', new ParseUUIDPipe()) noteId: string,
  ) {
    return this.service.removeNote(companyId, user.id, id, noteId);
  }
}
