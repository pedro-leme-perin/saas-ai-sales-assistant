// =====================================================
// 📚 EXAMPLE CONTROLLER - GUARDS USAGE
// =====================================================
// This is a reference/example controller showing ALL
// ways to use authentication and authorization guards
//
// Location: src/modules/example/example.controller.ts
//
// IMPORTANT: This is for REFERENCE ONLY!
// Copy patterns from here to your actual controllers.
// =====================================================

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

// =====================================================
// GUARDS
// =====================================================
import { AuthGuard } from '@modules/auth/guards/auth.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';

// =====================================================
// DECORATORS
// =====================================================
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Public } from '@modules/auth/decorators/roles.decorator';

// =====================================================
// TYPES
// =====================================================
import { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { TenantRequest } from '@modules/auth/guards/tenant.guard';
import { UserRole } from '@prisma/client';

// =====================================================
// CONTROLLER
// =====================================================
@ApiTags('Examples - Guard Usage')
@Controller('examples')
export class ExampleController {

  // =====================================================
  // EXAMPLE 1: PUBLIC ROUTE (NO AUTHENTICATION)
  // =====================================================
  // Anyone can access - no JWT required
  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public endpoint - no auth required' })
  publicEndpoint() {
    return {
      message: 'This is a public endpoint',
      authenticated: false,
    };
  }

  // =====================================================
  // EXAMPLE 2: BASIC AUTHENTICATION
  // =====================================================
  // Requires valid JWT token
  // User object available via @CurrentUser()
  @UseGuards(AuthGuard)
  @Get('protected')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Protected endpoint - requires authentication' })
  protectedEndpoint(@CurrentUser() user: AuthUser) {
    return {
      message: 'You are authenticated!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }

  // =====================================================
  // EXAMPLE 3: EXTRACT SPECIFIC USER PROPERTY
  // =====================================================
  // Get only specific property from user object
  @UseGuards(AuthGuard)
  @Get('my-email')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user email' })
  getMyEmail(@CurrentUser('email') email: string) {
    return {
      email,
    };
  }

  // =====================================================
  // EXAMPLE 4: AUTHENTICATION + TENANT ISOLATION
  // =====================================================
  // Ensures user belongs to a company
  // companyId injected into request
  @UseGuards(AuthGuard, TenantGuard)
  @Get('tenant-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tenant-specific data' })
  getTenantData(
    @CurrentUser() user: AuthUser,
    @Req() request: TenantRequest,
  ) {
    return {
      message: 'Tenant-isolated data',
      userId: user.id,
      companyId: request.companyId, // Injected by TenantGuard
    };
  }

  // =====================================================
  // EXAMPLE 5: ROLE-BASED ACCESS CONTROL (SINGLE ROLE)
  // =====================================================
  // Only ADMIN can access
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Delete('admin-only/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin only endpoint' })
  adminOnlyEndpoint(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      message: 'Admin action executed',
      deletedId: id,
      adminEmail: user.email,
    };
  }

  // =====================================================
  // EXAMPLE 6: MULTIPLE ROLES (OR LOGIC)
  // =====================================================
  // ADMIN OR MANAGER can access
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseGuards(AuthGuard, RolesGuard)
  @Get('reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Access for ADMIN or MANAGER' })
  getReports(@CurrentUser() user: AuthUser) {
    return {
      message: 'Reports data',
      requestedBy: user.email,
      role: user.role,
    };
  }

  // =====================================================
  // EXAMPLE 7: FULL STACK (AUTH + TENANT + ROLES)
  // =====================================================
  // Complete security: Authentication + Tenant + Role check
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Post('sensitive-action')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full security stack example' })
  fullSecurityEndpoint(
    @CurrentUser() user: AuthUser,
    @Req() request: TenantRequest,
    @Body() data: any,
  ) {
    return {
      message: 'Sensitive action executed',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      companyId: request.companyId, // From TenantGuard
      data,
    };
  }

  // =====================================================
  // EXAMPLE 8: GUARD ON ENTIRE CONTROLLER
  // =====================================================
  // Apply guard to ALL routes in this controller
  // (See bottom of file for controller-level guard)

  // =====================================================
  // EXAMPLE 9: VENDOR-ONLY ACCESS
  // =====================================================
  @Roles(UserRole.VENDOR)
  @UseGuards(AuthGuard, RolesGuard)
  @Get('my-calls')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vendor only - get my calls' })
  getMyCallsAsVendor(@CurrentUser() user: AuthUser) {
    return {
      message: 'Your calls data',
      vendorId: user.id,
      role: user.role,
    };
  }

  // =====================================================
  // EXAMPLE 10: PUBLIC BUT WITH OPTIONAL AUTH
  // =====================================================
  // Public endpoint but can detect if user is authenticated
  @Public()
  @Get('optional-auth')
  @ApiOperation({ summary: 'Public but can use auth if present' })
  optionalAuth(@CurrentUser() user?: AuthUser) {
    if (user) {
      return {
        message: 'You are authenticated',
        email: user.email,
      };
    }
    
    return {
      message: 'You are anonymous',
    };
  }
}

/**
 * =====================================================
 * CONTROLLER-LEVEL GUARDS
 * =====================================================
 * 
 * Apply guards to ALL routes in controller:
 * 
 * @UseGuards(AuthGuard, TenantGuard)
 * @Controller('users')
 * export class UsersController {
 *   // All routes require auth + tenant by default
 *   
 *   @Get()
 *   findAll() { } // Protected
 *   
 *   @Public() // Override controller guards
 *   @Get('public')
 *   publicRoute() { } // Public
 * }
 * 
 * =====================================================
 * GLOBAL GUARDS (in app.module.ts)
 * =====================================================
 * 
 * Apply to ALL routes in application:
 * 
 * providers: [
 *   {
 *     provide: APP_GUARD,
 *     useClass: AuthGuard, // All routes protected by default
 *   },
 * ]
 * 
 * Then use @Public() to make specific routes public.
 * 
 * =====================================================
 * REAL-WORLD EXAMPLES
 * =====================================================
 * 
 * 1. CALLS CONTROLLER
 * ```typescript
 * @UseGuards(AuthGuard, TenantGuard)
 * @Controller('calls')
 * export class CallsController {
 *   @Get()
 *   findAll(@CurrentUser('companyId') companyId: string) {
 *     return this.callsService.findAll(companyId);
 *   }
 *   
 *   @Roles(UserRole.ADMIN)
 *   @UseGuards(RolesGuard)
 *   @Delete(':id')
 *   delete(@Param('id') id: string) {
 *     return this.callsService.delete(id);
 *   }
 * }
 * ```
 * 
 * 2. USERS CONTROLLER
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   @Public()
 *   @Post('register')
 *   register(@Body() data: RegisterDto) {
 *     // Public registration
 *   }
 *   
 *   @UseGuards(AuthGuard)
 *   @Get('me')
 *   getProfile(@CurrentUser() user: AuthUser) {
 *     return user;
 *   }
 *   
 *   @Roles(UserRole.ADMIN)
 *   @UseGuards(AuthGuard, RolesGuard)
 *   @Get()
 *   listAllUsers() {
 *     // Admin only
 *   }
 * }
 * ```
 * 
 * 3. BILLING CONTROLLER
 * ```typescript
 * @UseGuards(AuthGuard, TenantGuard)
 * @Controller('billing')
 * export class BillingController {
 *   @Roles(UserRole.ADMIN)
 *   @UseGuards(RolesGuard)
 *   @Post('subscription')
 *   createSubscription(
 *     @CurrentUser('companyId') companyId: string,
 *     @Body() data: CreateSubscriptionDto,
 *   ) {
 *     return this.billingService.create(companyId, data);
 *   }
 * }
 * ```
 * 
 * =====================================================
 * TESTING GUARDS
 * =====================================================
 * 
 * 1. Get JWT token from Clerk:
 *    - Login via frontend
 *    - Copy token from localStorage or network tab
 * 
 * 2. Test with curl:
 * ```bash
 * # Public endpoint (no token needed)
 * curl http://localhost:3001/examples/public
 * 
 * # Protected endpoint (token required)
 * curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *      http://localhost:3001/examples/protected
 * 
 * # Admin only (requires ADMIN role)
 * curl -X DELETE \
 *      -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
 *      http://localhost:3001/examples/admin-only/123
 * ```
 * 
 * 3. Test with Postman/Insomnia:
 *    - Set Authorization: Bearer Token
 *    - Paste your JWT
 *    - Try different endpoints
 * 
 * =====================================================
 * TROUBLESHOOTING
 * =====================================================
 * 
 * 401 Unauthorized:
 * - Check if token is valid
 * - Check if CLERK_SECRET_KEY is correct
 * - Check if user exists in database
 * 
 * 403 Forbidden:
 * - User is authenticated but lacks required role
 * - Check user.role in database
 * - Check @Roles() decorator
 * 
 * User not associated with company:
 * - Check if user.companyId exists
 * - Sync user with company during registration
 * 
 * =====================================================
 */
