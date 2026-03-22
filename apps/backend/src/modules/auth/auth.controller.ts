// src/modules/auth/auth.controller.ts

import { Controller, Get, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserWithCompany } from '@/modules/users/users.service';

// Rate limit auth endpoints (System Design Interview - Cap. 4)
// Prevent brute force / session enumeration
@ApiTags('auth')
@ApiBearerAuth('JWT')
@Throttle({ auth: { ttl: 60000, limit: 30 } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  @Get('me')
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description: 'Returns full profile of authenticated user including company details',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        company: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
  })
  async getMe(@CurrentUser() user: UserWithCompany) {
    this.logger.debug(`Getting user profile: ${user.id}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      status: user.status,
      companyId: user.companyId,
      company: {
        id: user.company.id,
        name: user.company.name,
        plan: user.company.plan,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Get('session')
  @ApiOperation({
    summary: 'Check session validity',
    description: 'Validates current session and returns basic user/company context',
  })
  @ApiResponse({
    status: 200,
    description: 'Session is valid',
    schema: {
      properties: {
        valid: { type: 'boolean' },
        userId: { type: 'string' },
        companyId: { type: 'string' },
        role: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Session invalid or expired',
  })
  async checkSession(@CurrentUser() user: UserWithCompany) {
    return {
      valid: true,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    };
  }
}
