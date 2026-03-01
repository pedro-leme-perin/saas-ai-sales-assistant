// =============================================
// 💳 BILLING CONTROLLER
// =============================================
// REST API endpoints for subscription management
// Clean Architecture: Interface Adapter Layer (Presentation)
// Pattern: Humble Object - thin controller delegates to service
// References: Clean Architecture Ch.22-23, Release It! Ch.4
// =============================================

import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BillingService, PlanDetails } from './billing.service';
import { CurrentUser, AuthenticatedUser, Roles, CompanyId } from '@common/decorators';
import { RolesGuard } from '@common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { CreateCheckoutDto, ChangePlanDto } from './dto/billing.dto';

// =============================================
// CONTROLLER
// =============================================

/**
 * Billing Controller
 * 
 * Responsibilities (Clean Architecture - Interface Adapters):
 * 1. Convert HTTP requests → Service method calls
 * 2. Apply authentication/authorization (guards)
 * 3. Format responses for API consumers
 * 4. NO business logic (that belongs in BillingService)
 * 
 * Pattern: Humble Object
 * - Controller is "humble" (minimal logic, hard to test)
 * - Service is "testable" (all business logic, easy to test)
 * 
 * Security:
 * - All endpoints require JWT authentication
 * - Critical operations (checkout, cancel) require OWNER/ADMIN roles
 * - Tenant isolation via @CompanyId() decorator
 */
@ApiTags('Billing')
@ApiBearerAuth('JWT-auth')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // =============================================
  // GET CURRENT SUBSCRIPTION
  // =============================================
  /**
   * Get subscription details for current company
   * 
   * Returns:
   * - Active/trialing subscription
   * - Current plan details
   * - Usage limits
   * 
   * Authorization: Any authenticated user in company
   */
  @Get('subscription')
  @ApiOperation({ 
    summary: 'Get current subscription',
    description: 'Returns subscription details, plan info, and usage limits for the company',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription details retrieved successfully',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Company not found',
  })
  async getSubscription(@CompanyId() companyId: string) {
    // Clean Architecture: Controller just converts and delegates
    // No business logic here - all in service
    return this.billingService.getSubscription(companyId);
  }

  // =============================================
  // GET INVOICE HISTORY
  // =============================================
  /**
   * Get invoice history for company
   * 
   * Returns last 24 months of invoices ordered by date (newest first)
   * 
   * Authorization: Any authenticated user in company
   */
  @Get('invoices')
  @ApiOperation({ 
    summary: 'Get invoice history',
    description: 'Returns last 24 invoices ordered by creation date',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Invoices retrieved successfully',
  })
  async getInvoices(@CompanyId() companyId: string) {
    return this.billingService.getInvoices(companyId);
  }

  // =============================================
  // GET AVAILABLE PLANS
  // =============================================
  /**
   * Get all available subscription plans
   * 
   * Public endpoint - shows pricing and features
   * Used for plan selection during onboarding
   * 
   * Authorization: Any authenticated user
   */
  @Get('plans')
  @ApiOperation({ 
    summary: 'Get available plans',
    description: 'Returns all available subscription plans with pricing and features',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plans retrieved successfully',
    type: [Object], // PlanDetails[] in production would have proper DTO
  })
  async getPlans(): Promise<PlanDetails[]> {
    return this.billingService.getPlans();
  }

  // =============================================
  // CREATE CHECKOUT SESSION
  // =============================================
  /**
   * Create Stripe checkout session for plan purchase
   * 
   * Flow:
   * 1. Validate user has permission (OWNER/ADMIN only)
   * 2. Create Stripe checkout session
   * 3. Return checkout URL for redirect
   * 
   * Authorization: OWNER or ADMIN only
   * 
   * Release It! principle: Fail fast
   * - Guards check authorization BEFORE hitting database
   * - DTO validation happens BEFORE service call
   */
  @Post('checkout')
  @HttpCode(HttpStatus.OK) // POST but returns 200 (not 201) - no resource created yet
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ 
    summary: 'Create Stripe checkout session',
    description: 'Creates a Stripe checkout session and returns URL for payment',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Checkout session created successfully',
    schema: {
      properties: {
        url: { type: 'string', description: 'Stripe checkout URL' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid plan or payment provider error',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions (OWNER/ADMIN required)',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Company not found',
  })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Release It!: Input validation already done by DTO pipe
    // Guards already checked authorization
    // Now just delegate to service
    return this.billingService.createCheckoutSession(dto.plan, companyId, user);
  }

  // =============================================
  // CHANGE SUBSCRIPTION PLAN
  // =============================================
  /**
   * Change company's subscription plan
   * 
   * Flow:
   * 1. Validate permissions (OWNER/ADMIN)
   * 2. Validate new plan is different
   * 3. Update company plan + limits
   * 4. Create audit log
   * 
   * Authorization: OWNER or ADMIN only
   * 
   * Note: This is immediate plan change (not via Stripe for now)
   * In production with Stripe, this would modify the subscription
   */
  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ 
    summary: 'Change subscription plan',
    description: 'Upgrades or downgrades the company subscription plan',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plan changed successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        plan: { type: 'object', description: 'New plan details' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid plan or already on this plan',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Company not found',
  })
  async changePlan(
    @Body() dto: ChangePlanDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.changePlan(dto.plan, companyId, user);
  }

  // =============================================
  // CANCEL SUBSCRIPTION
  // =============================================
  /**
   * Cancel active subscription
   * 
   * Soft cancellation: subscription remains active until period end
   * This is user-friendly - they keep access until they've paid for
   * 
   * Authorization: OWNER only (most critical operation)
   * 
   * Release It!: Fail fast
   * - Guards block non-owners immediately
   * - Service throws NotFoundException if no active subscription
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER) // Only OWNER can cancel (most restrictive)
  @UseGuards(RolesGuard)
  @ApiOperation({ 
    summary: 'Cancel subscription',
    description: 'Cancels subscription at end of billing period (soft cancel)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Subscription cancelled successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        cancelAtPeriodEnd: { type: 'boolean' },
        currentPeriodEnd: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions (OWNER required)',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'No active subscription found',
  })
  async cancelSubscription(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.cancelSubscription(companyId, user);
  }

  // =============================================
  // GET STRIPE CUSTOMER PORTAL
  // =============================================
  /**
   * Get URL to Stripe customer portal
   * 
   * Customer portal allows users to:
   * - Update payment method
   * - View invoice history
   * - Download receipts
   * - Update billing info
   * 
   * Authorization: OWNER or ADMIN
   */
  @Get('portal')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ 
    summary: 'Get Stripe customer portal URL',
    description: 'Returns URL to Stripe portal for managing payment methods and viewing invoices',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Portal URL generated successfully',
    schema: {
      properties: {
        url: { type: 'string', description: 'Stripe customer portal URL' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'No Stripe customer ID found',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions',
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Company not found',
  })
  async getPortalUrl(@CompanyId() companyId: string) {
    return this.billingService.getPortalUrl(companyId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billingService.handleWebhook(payload, signature);
  }
}
