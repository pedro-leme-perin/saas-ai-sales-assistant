// =====================================================
// 🏢 COMPANIES CONTROLLER - COMPLETE AND FIXED
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuthGuard } from '@modules/auth/guards/auth.guard';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current user company' })
  async getCurrent(@CurrentUser() user: any) {
    const company = await this.companiesService.findOne(user.companyId);
    return { success: true, data: company };
  }

  @Get('current/usage')
  @ApiOperation({ summary: 'Get current company usage' })
  async getCurrentUsage(@CurrentUser() user: any) {
    const company = await this.companiesService.findOne(user.companyId);
    const usage = {
      plan: company.plan,
      users: {
        used: company.users?.length || 0,
        limit: company.maxUsers || 0,
        percentage: company.maxUsers ? Math.round(((company.users?.length || 0) / company.maxUsers) * 100) : 0,
      },
      calls: {
        used: company._count?.calls || 0,
        limit: company.maxCallsPerMonth || 0,
        percentage: company.maxCallsPerMonth ? Math.round(((company._count?.calls || 0) / company.maxCallsPerMonth) * 100) : 0,
      },
      chats: {
        used: company._count?.whatsappChats || 0,
        limit: company.maxChatsPerMonth || 0,
        percentage: company.maxChatsPerMonth ? Math.round(((company._count?.whatsappChats || 0) / company.maxChatsPerMonth) * 100) : 0,
      },
    };
    return { success: true, data: usage };
  }

  @Get('current/stats')
  @ApiOperation({ summary: 'Get current company stats' })
  async getCurrentStats(@CurrentUser() user: any) {
    const stats = await this.companiesService.getStats(user.companyId);
    return { success: true, data: stats };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    const company = await this.companiesService.create(createCompanyDto);
    return { success: true, data: company };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.companiesService.findOne(id);
    return { success: true, data: company };
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companiesService.update(id, updateCompanyDto);
    return { success: true, data: company };
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    const stats = await this.companiesService.getStats(id);
    return { success: true, data: stats };
  }
}


