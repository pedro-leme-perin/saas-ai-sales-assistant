// =============================================
// 📡 PresenceController (Session 57 — Feature A1)
// =============================================

import {
  Body,
  Controller,
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
import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { PresenceService } from './presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';

@ApiTags('presence')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly service: PresenceService) {}

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agent heartbeat (called every ~30s by client)' })
  async heartbeat(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HeartbeatDto,
  ) {
    return this.service.heartbeat(user.id, companyId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my current presence row' })
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my presence (status / statusMessage / capacity)' })
  async updateMine(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePresenceDto,
  ) {
    return this.service.updateMine(user.id, companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all presences for this tenant' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.service.listActive(companyId) };
  }

  @Get('users/:userId/capacity')
  @ApiOperation({ summary: 'Capacity lookup for a specific vendor' })
  async capacity(
    @CompanyId() companyId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.service.getCapacityFor(companyId, userId);
  }
}
