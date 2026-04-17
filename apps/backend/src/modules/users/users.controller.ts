// src/modules/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Logger,
  Query,
  Request,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CompanyId } from '@/modules/auth/decorators/current-user.decorator';
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';
import { InviteUserDto, UpdateUserRoleDto } from './dto/user.dto';
import { RequestDeletionDto } from './dto/request-deletion.dto';

// Interface for authenticated requests
interface AuthenticatedRequest {
  user?: {
    id?: string;
    companyId?: string;
  };
}

@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // ============================================
  // LGPD COMPLIANCE (Lei Geral de Protecao de Dados)
  // Must be declared BEFORE :id routes to avoid param conflicts
  // ============================================

  @Get('me/export-data')
  @ApiOperation({
    summary: 'Export all user data (LGPD Art. 18, V)',
    description:
      'Returns all data associated with the authenticated user in JSON format. ' +
      'Includes profile, calls, WhatsApp chats, AI suggestions, notifications, and audit logs. ' +
      'Tenant-isolated: only returns data within the user company.',
  })
  @ApiResponse({
    status: 200,
    description: 'User data exported successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'User context not found',
  })
  async exportUserData(@Request() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new UnauthorizedException('User context not found');
    }

    this.logger.log(
      `LGPD data export requested by user ${userId} in company ${companyId}`,
    );

    const data = await this.usersService.exportUserData(userId, companyId);

    return {
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      data,
    };
  }

  @Post('me/request-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request account deletion (LGPD Art. 18, VI)',
    description:
      'Requests deletion of the authenticated user account and associated data. ' +
      'Does not immediately delete — suspends the account and schedules deletion in 30 days. ' +
      'A confirmation email is sent to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion request created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'User context not found',
  })
  async requestDeletion(
    @Request() req: AuthenticatedRequest,
    @Body() body: RequestDeletionDto,
  ) {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      throw new UnauthorizedException('User context not found');
    }

    this.logger.log(
      `LGPD deletion request by user ${userId} in company ${companyId}`,
    );

    return this.usersService.requestAccountDeletion(
      userId,
      companyId,
      body.reason,
    );
  }

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  @Get()
  @ApiOperation({
    summary: 'List all company users',
    description: 'Returns paginated list of users in authenticated user company (tenant isolated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async findAll(@CompanyId() companyId: string, @Query('limit') limit?: string) {
    const users = await this.usersService.findAllByCompany(companyId, parseInt(limit || '50'));
    return {
      data: users,
      meta: { total: users.length },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user details by ID',
    description: 'Retrieve full profile for specific user (tenant isolated)',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    this.logger.debug(`Finding user ${id} for company ${companyId}`);

    const user = await this.usersService.findByIdOrThrow(id, companyId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a user to the company',
    description:
      'Send an invitation to a new user. Creates a PENDING user record that becomes ACTIVE when the invited person signs up.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists in company',
  })
  async invite(@Request() req: AuthenticatedRequest, @Body() body: InviteUserDto) {
    const companyId = req.user?.companyId;
    const inviterId = req.user?.id;

    if (!companyId || !inviterId) {
      throw new UnauthorizedException('User context not found');
    }

    this.logger.log(`User ${inviterId} inviting ${body.email} to company ${companyId}`);

    return this.usersService.inviteUser(companyId, body.email, body.role, inviterId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a user from the company',
    description: 'Soft-delete active users or hard-delete pending invitations',
  })
  @ApiResponse({
    status: 200,
    description: 'User removed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove the last admin',
  })
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const companyId = req.user?.companyId;

    if (!companyId) {
      throw new UnauthorizedException('User context not found');
    }

    this.logger.log(`Removing user ${id} from company ${companyId}`);

    return this.usersService.removeUser(id, companyId);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: "Update a user's role",
    description: 'Change the role (permission level) of a user in the company',
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or no change',
  })
  async updateRole(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    const companyId = req.user?.companyId;

    if (!companyId) {
      throw new UnauthorizedException('User context not found');
    }

    this.logger.log(`Updating role for user ${id} to ${body.role}`);

    const updated = await this.usersService.updateUserRole(id, companyId, body.role);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      updatedAt: updated.updatedAt,
    };
  }

}
