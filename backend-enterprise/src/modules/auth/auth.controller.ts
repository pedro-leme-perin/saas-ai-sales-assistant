// src/modules/auth/auth.controller.ts

import { Controller, Get, Logger } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserWithCompany } from '@/modules/users/users.service';

@Controller('auth')  // ← CORRIGIDO: removido 'api/'
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /**
   * GET /api/auth/me
   * Retorna dados do usuário autenticado
   */
  @Get('me')
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
      companyId: user.companyId,  // ← ADICIONADO: necessário para o frontend
      company: {
        id: user.company.id,
        name: user.company.name,
        plan: user.company.plan,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * GET /api/auth/session
   * Verifica se a sessão é válida (usado pelo frontend)
   */
  @Get('session')
  async checkSession(@CurrentUser() user: UserWithCompany) {
    return {
      valid: true,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    };
  }
}