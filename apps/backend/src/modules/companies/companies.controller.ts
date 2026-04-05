// =====================================================
// 🏢 COMPANIES CONTROLLER - COMPLETE AND FIXED
// =====================================================
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { AuthGuard } from '@modules/auth/guards/auth.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

interface CurrentUserPayload {
  id: string;
  companyId: string;
  email: string;
  role: string;
}

@ApiTags('companies')
@Controller('companies')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current user company',
    description: 'Returns company profile for authenticated user tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Company profile retrieved successfully',
  })
  async getCurrent(@CurrentUser() user: CurrentUserPayload) {
    const company = await this.companiesService.findOne(user.companyId);
    return { success: true, data: company };
  }

  @Get('current/usage')
  @ApiOperation({
    summary: 'Get current company usage',
    description: 'Returns usage metrics for users, calls, and chats against plan limits',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage metrics retrieved successfully',
  })
  async getCurrentUsage(@CurrentUser() user: CurrentUserPayload) {
    const company = await this.companiesService.findOne(user.companyId);
    const usage = {
      plan: company.plan,
      users: {
        used: company.users?.length || 0,
        limit: company.maxUsers || 0,
        percentage: company.maxUsers
          ? Math.round(((company.users?.length || 0) / company.maxUsers) * 100)
          : 0,
      },
      calls: {
        used: company._count?.calls || 0,
        limit: company.maxCallsPerMonth || 0,
        percentage: company.maxCallsPerMonth
          ? Math.round(((company._count?.calls || 0) / company.maxCallsPerMonth) * 100)
          : 0,
      },
      chats: {
        used: company._count?.whatsappChats || 0,
        limit: company.maxChatsPerMonth || 0,
        percentage: company.maxChatsPerMonth
          ? Math.round(((company._count?.whatsappChats || 0) / company.maxChatsPerMonth) * 100)
          : 0,
      },
    };
    return { success: true, data: usage };
  }

  @Get('current/stats')
  @ApiOperation({
    summary: 'Get current company statistics',
    description: 'Returns aggregated stats: active users, call volume, chat activity',
  })
  @ApiResponse({
    status: 200,
    description: 'Company statistics retrieved successfully',
  })
  async getCurrentStats(@CurrentUser() user: CurrentUserPayload) {
    const stats = await this.companiesService.getStats(user.companyId);
    return { success: true, data: stats };
  }

  @Put('current')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update current company',
    description: 'Updates current user company profile and settings (OWNER/ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
  })
  async updateCurrent(
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    const company = await this.companiesService.update(user.companyId, updateCompanyDto);
    return { success: true, data: company };
  }

  @Post('current/onboarding')
  @ApiOperation({
    summary: 'Complete onboarding',
    description: 'Saves onboarding data and marks company as onboarded',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed successfully',
  })
  async completeOnboarding(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CompleteOnboardingDto,
  ) {
    const company = await this.companiesService.completeOnboarding(user.companyId, dto);
    return { success: true, data: company };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create company',
    description: 'Creates new company (OWNER/ADMIN only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
  })
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    const company = await this.companiesService.create(createCompanyDto);
    return { success: true, data: company };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get company by ID',
    description: 'Retrieve company profile and configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Company retrieved successfully',
  })
  async findOne(@Param('id') id: string) {
    const company = await this.companiesService.findOne(id);
    return { success: true, data: company };
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update company',
    description: 'Updates company profile and settings (OWNER/ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
  })
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companiesService.update(id, updateCompanyDto);
    return { success: true, data: company };
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get company statistics by ID',
    description: 'Returns detailed statistics for specific company',
  })
  @ApiResponse({
    status: 200,
    description: 'Company statistics retrieved successfully',
  })
  async getStats(@Param('id') id: string) {
    const stats = await this.companiesService.getStats(id);
    return { success: true, data: stats };
  }
}
