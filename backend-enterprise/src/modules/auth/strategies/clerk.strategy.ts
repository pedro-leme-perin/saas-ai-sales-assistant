// src/modules/auth/strategies/clerk.strategy.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { verifyToken } from '@clerk/backend';
import { UsersService, UserWithCompany } from '../../users/users.service';
import { ClerkJwtPayload } from '../interfaces/clerk.interfaces';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(private readonly usersService: UsersService) {
    super();
  }

  async validate(request: Request): Promise<UserWithCompany> {
    this.logger.debug('=== AUTHENTICATION FLOW START ===');

    // 1. Extrair token do header
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      this.logger.warn('No token found in request');
      throw new UnauthorizedException('No authentication token provided');
    }
    this.logger.debug('Token extracted from header');

    // 2. Verificar token com Clerk
    let payload: ClerkJwtPayload;
    try {
      this.logger.debug('Verifying token with Clerk...');
      
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        authorizedParties: this.getAuthorizedParties(),
      }) as ClerkJwtPayload;
      
      this.logger.debug('Token verified successfully');
      this.logger.debug(`Clerk ID from token: ${payload.sub}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Token verification failed: ${message}`);
      throw new UnauthorizedException('Invalid authentication token');
    }

    // 3. Validar payload
    if (!payload.sub) {
      this.logger.error('Token payload missing subject (sub)');
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.sts !== 'active') {
      this.logger.warn(`Session not active: ${payload.sts}`);
      throw new UnauthorizedException('Session is not active');
    }

    // 4. Buscar usuário no banco local
    this.logger.debug('Searching database for user...');
    let user = await this.usersService.findByClerkId(payload.sub);

    // 5. AUTO-PROVISIONING: Criar usuário se não existir
    if (!user) {
      this.logger.warn(`User not found for Clerk ID: ${payload.sub}`);
      this.logger.log('Initiating auto-provisioning...');
      
      try {
        user = await this.usersService.createFromClerkPayload(payload);
        this.logger.log(`User auto-provisioned successfully: ${user.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Auto-provisioning failed: ${message}`, stack);
        throw new UnauthorizedException(
          'User provisioning failed. Please contact support.',
        );
      }
    }

    // 6. Verificar se usuário está ativo
    if (!user.isActive) {
      this.logger.warn(`User is inactive: ${user.id}`);
      throw new UnauthorizedException('User account is inactive');
    }

    // 7. Atualizar último acesso (fire and forget)
    this.usersService.updateLastAccess(user.id).catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Failed to update last access: ${message}`);
    });

    this.logger.debug(`Authentication successful for user: ${user.id}`);
    this.logger.debug('=== AUTHENTICATION FLOW END ===');

    return user;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private getAuthorizedParties(): string[] {
    const parties = [
      process.env.FRONTEND_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean) as string[];

    return [...new Set(parties.map(p => p.replace(/\/$/, '')))];
  }
}
