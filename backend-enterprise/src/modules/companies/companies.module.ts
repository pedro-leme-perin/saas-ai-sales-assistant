// ====================================================
// 🏢 COMPANIES MODULE
// ====================================================

import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [AuthModule], // Import AuthModule for ClerkStrategy
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}