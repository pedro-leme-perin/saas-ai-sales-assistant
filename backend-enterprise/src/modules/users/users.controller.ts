// src/modules/users/users.controller.ts

import { Controller, Get, Param, Logger, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, CompanyId } from '@/modules/auth/decorators/current-user.decorator';
import { UserWithCompany } from './users.service';

@ApiTags('users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

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
}
