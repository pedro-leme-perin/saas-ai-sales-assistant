// =============================================
// 🎭 ImpersonationController (Session 58 — Feature A1)
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
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { StartImpersonationDto } from './dto/start-impersonation.dto';
import { ImpersonationService } from './impersonation.service';

@ApiTags('impersonation')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('impersonation')
export class ImpersonationController {
  constructor(private readonly service: ImpersonationService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Start an impersonation session. Token is emitted ONCE and never returned again.',
  })
  async start(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartImpersonationDto,
    @Req() req: Request,
  ) {
    const ipAddress = this.extractIp(req);
    const userAgent = this.extractUserAgent(req);
    return this.service.start(companyId, { id: user.id, role: user.role }, dto, {
      ipAddress,
      userAgent,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'End an impersonation session (actor only).' })
  async end(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('reason') reason?: string,
  ) {
    return this.service.end(companyId, user.id, id, reason);
  }

  @Get('sessions')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List active impersonation sessions for this tenant.' })
  async listActive(@CompanyId() companyId: string, @Query('actorUserId') actorUserId?: string) {
    return this.service.listActive(companyId, actorUserId);
  }

  @Get('sessions/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get impersonation session detail.' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(companyId, id);
  }

  private extractIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    if (Array.isArray(forwarded)) return forwarded[0];
    return req.ip ?? req.socket?.remoteAddress ?? undefined;
  }

  private extractUserAgent(req: Request): string | undefined {
    const ua = req.headers['user-agent'];
    if (typeof ua === 'string') return ua.slice(0, 500);
    return undefined;
  }
}
