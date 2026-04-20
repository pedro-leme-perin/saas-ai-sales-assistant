// =============================================
// 📄 API REQUEST LOGS MODULE (Session 52)
// =============================================

import { Module } from '@nestjs/common';
import { ApiRequestLogsController } from './api-request-logs.controller';
import { ApiRequestLogsService } from './api-request-logs.service';
import { ApiRequestLogsInterceptor } from './api-request-logs.interceptor';

@Module({
  controllers: [ApiRequestLogsController],
  providers: [ApiRequestLogsService, ApiRequestLogsInterceptor],
  exports: [ApiRequestLogsService, ApiRequestLogsInterceptor],
})
export class ApiRequestLogsModule {}
