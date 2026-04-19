// =============================================
// 🔔 WEBHOOKS CONTROLLER (Session 46)
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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyId, CurrentUser, Roles, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints for the current company' })
  async list(@CompanyId() companyId: string) {
    return { data: await this.webhooks.list(companyId) };
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'List recent webhook deliveries (audit/debug)' })
  async deliveries(
    @CompanyId() companyId: string,
    @Query('endpointId') endpointId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return {
      data: await this.webhooks.listDeliveries(companyId, endpointId ?? null, parsed, cursor),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single webhook endpoint' })
  async findById(@CompanyId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webhooks.findById(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  @ApiResponse({ status: 201, description: 'Endpoint created' })
  async create(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooks.create(companyId, user, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(companyId, id, user, dto);
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Rotate the HMAC secret for an endpoint' })
  async rotate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webhooks.rotateSecret(companyId, id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webhooks.remove(companyId, id, user);
  }
}
