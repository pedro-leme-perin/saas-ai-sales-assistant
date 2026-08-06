// =============================================
// 📞 VoiceNumbersController — ADR-018
// =============================================
// Endpoints:
//   GET    /voice-numbers/available  — search numbers for sale (read-only, costs nothing)
//   GET    /voice-numbers            — the number currently assigned to the caller's tenant
//   POST   /voice-numbers            — buy a number and assign it to the caller's tenant
//   DELETE /voice-numbers            — release the tenant's number back to Twilio
//
// Every route is scoped to the caller's own tenant via @CompanyId — there is deliberately no
// "provision for company X" parameter. Buying telephony on behalf of an arbitrary tenant is
// exactly the kind of endpoint that turns into a cross-tenant hole, and the whole point of
// ADR-018 is to stop treating tenant identity as something a caller can supply.

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';

import { VoiceNumbersService } from './voice-numbers.service';
import { ProvisionVoiceNumberDto, SearchVoiceNumbersDto } from './dto/voice-number.dto';

@ApiTags('voice-numbers')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard, RolesGuard)
@Controller('voice-numbers')
export class VoiceNumbersController {
  constructor(private readonly voiceNumbersService: VoiceNumbersService) {}

  @Get('available')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search phone numbers available for purchase' })
  async listAvailable(@Query() query: SearchVoiceNumbersDto) {
    return this.voiceNumbersService.listAvailable(query.countryCode, query.areaCode, query.limit);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Get this tenant's assigned voice number" })
  async getCurrent(@CompanyId() companyId: string) {
    return this.voiceNumbersService.getForCompany(companyId);
  }

  // OWNER only, and not because of the money — MANAGER and ADMIN can already spend in other
  // places. It is because the voice number is the tenant's public identity to its own
  // customers, and swapping it is closer to changing the company name than to a settings edit.
  @Post()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buy a number and assign it to this tenant' })
  async provision(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProvisionVoiceNumberDto,
  ) {
    return this.voiceNumbersService.provisionForCompany(companyId, dto.phoneNumber, user.id);
  }

  @Delete()
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Release this tenant's number back to Twilio" })
  async release(@CompanyId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.voiceNumbersService.releaseForCompany(companyId, user.id);
  }
}
