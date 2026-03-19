// src/modules/users/users.controller.ts

import { Controller, Get, Param, Logger, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser, CompanyId } from '@/modules/auth/decorators/current-user.decorator';
import { UserWithCompany } from './users.service';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/:id
   * Busca usuário por ID (com tenant isolation)
   */
  @Get()
  async findAll(@CompanyId() companyId: string, @Query('limit') limit?: string) {
    const users = await this.usersService.findAllByCompany(companyId, parseInt(limit || '50'));
    return {
      data: users,
      meta: { total: users.length },
    };
  }

  @Get(':id')
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
