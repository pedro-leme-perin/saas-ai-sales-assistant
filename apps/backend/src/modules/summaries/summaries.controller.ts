// =============================================
// 📄 SUMMARIES CONTROLLER
// =============================================
// Session 44: POST /summaries/calls/:id + POST /summaries/chats/:id
// Clean Architecture: thin HTTP adapter — logic lives in SummariesService.
// =============================================

import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CompanyId, CurrentUser, type AuthenticatedUser } from '@common/decorators';
import { TenantGuard } from '@modules/auth/guards/tenant.guard';
import { SummariesService } from './summaries.service';

@ApiTags('summaries')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
// Summary generation is LLM-backed and expensive — cap per-user bursts.
@Throttle({ default: { ttl: 60_000, limit: 15 } })
@Controller('summaries')
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Post('calls/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate / fetch summary for a call',
    description:
      'Returns keyPoints, sentimentTimeline and nextBestAction. Cached in Redis for 24h; identical transcripts hit cache.',
  })
  @ApiResponse({ status: 200, description: 'Summary returned' })
  @ApiResponse({ status: 400, description: 'Call has no transcript yet' })
  @ApiResponse({ status: 404, description: 'Call not found in tenant' })
  async summarizeCall(
    @Param('id', new ParseUUIDPipe()) callId: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaries.summarizeCall(callId, companyId, user.id);
  }

  @Post('chats/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate / fetch summary for a WhatsApp chat',
    description:
      'Summarises up to 80 most-recent messages. Cached in Redis for 24h; cache invalidates on new messages via content hash.',
  })
  @ApiResponse({ status: 200, description: 'Summary returned' })
  @ApiResponse({ status: 400, description: 'Chat has no messages' })
  @ApiResponse({ status: 404, description: 'Chat not found in tenant' })
  async summarizeChat(
    @Param('id', new ParseUUIDPipe()) chatId: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaries.summarizeChat(chatId, companyId, user.id);
  }
}
