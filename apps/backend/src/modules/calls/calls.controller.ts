import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Res,
  HttpCode,
  Request,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';
import { TwilioSignatureGuard } from '@/common/guards/twilio-signature.guard';
import { Response } from 'express';
import * as twilio from 'twilio';

@ApiTags('calls')
@ApiBearerAuth('JWT')
@Controller('calls')
export class CallsController {
  private readonly logger = new Logger(CallsController.name);

  constructor(
    private readonly callsService: CallsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':companyId')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'List all calls for company',
    description: 'Returns paginated list of calls with transcripts, duration, status',
  })
  @ApiResponse({
    status: 200,
    description: 'Calls retrieved successfully',
  })
  async findAll(@Param('companyId') companyId: string) {
    return this.callsService.findAll(companyId);
  }

  @Get(':companyId/stats')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get call statistics',
    description: 'Returns aggregated call stats: count, avg duration, status breakdown',
  })
  @ApiResponse({
    status: 200,
    description: 'Call statistics retrieved successfully',
  })
  async getStats(@Param('companyId') companyId: string) {
    return this.callsService.getCallStats(companyId);
  }

  @Get(':companyId/:id')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get call details',
    description: 'Retrieve full details for specific call including transcript and metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Call details retrieved successfully',
  })
  async findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.callsService.findOne(id, companyId);
  }

  @Post(':companyId')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Create a call record',
    description: 'Creates a new call record for tracking',
  })
  @ApiResponse({
    status: 201,
    description: 'Call created successfully',
  })
  async create(
    @Param('companyId') companyId: string,
    @Body() data: { phoneNumber: string; direction?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.callsService.create(companyId, req.user.id, data);
  }

  @Put(':companyId/:id')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Update call details',
    description: 'Updates call transcript, status, duration, or other metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Call updated successfully',
  })
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body()
    data: {
      phoneNumber?: string;
      direction?: string;
      status?: string;
      transcript?: string;
      duration?: number;
    },
  ) {
    return this.callsService.update(id, companyId, data);
  }

  @Post(':companyId/initiate')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Initiate outbound call',
    description: 'Starts an outbound call to specified phone number via Twilio Media Streams',
  })
  @ApiResponse({
    status: 200,
    description: 'Call initiated successfully',
  })
  async initiateCall(
    @Param('companyId') companyId: string,
    @Body() data: { phoneNumber: string },
    @Request() req: { user: { id: string } },
  ) {
    const webhookUrl =
      this.configService.get<string>('twilio.webhookUrl') || process.env.BACKEND_URL;
    if (!webhookUrl) {
      throw new Error('TWILIO_WEBHOOK_URL or BACKEND_URL must be configured');
    }
    return this.callsService.initiateCall(companyId, req.user.id, data.phoneNumber, webhookUrl);
  }

  @Post(':companyId/:id/end')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'End active call',
    description: 'Terminates an active call and saves final transcript',
  })
  @ApiResponse({
    status: 200,
    description: 'Call ended successfully',
  })
  async endCall(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.callsService.endCall(id, companyId);
  }

  // =====================================================
  // TWILIO WEBHOOKS
  // =====================================================

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle() // Twilio webhooks are server-to-server
  @Post('webhook/voice/:callId')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleVoiceWebhook(@Param('callId') callId: string, @Res() res: Response) {
    this.logger.log(`Voice webhook called for call: ${callId}`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const backendUrl = process.env.NGROK_URL || process.env.BACKEND_URL;
    if (!backendUrl) {
      this.logger.error('BACKEND_URL not configured — voice webhook cannot route media stream');
      res.type('text/xml');
      res.send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error</Say></Response>',
      );
      return;
    }
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    this.logger.log(`WebSocket URL: ${wsUrl}/ws/media`);

    // Greet
    response.say({ language: 'pt-BR', voice: 'Polly.Camila' }, 'Assistente de vendas conectado.');

    // Fork audio to WebSocket for real-time transcription
    // <Start><Stream> keeps the call alive while streaming audio
    const start = response.start();
    start.stream({
      url: `${wsUrl}/ws/media`,
      track: 'inbound_track',
    });

    // Keep call alive
    response.pause({ length: 3600 });

    const twiml = response.toString();
    this.logger.log(`TwiML: ${twiml}`);

    res.type('text/xml');
    res.send(twiml);
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle()
  @Post('webhook/voice')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleVoiceWebhookInbound(
    @Body() body: { CallSid: string; From: string; To: string },
    @Res() res: Response,
  ) {
    this.logger.log(`Inbound voice webhook: CallSid=${body.CallSid} From=${body.From}`);
    await this.callsService.findOrCreateByCallSid(body.CallSid, body.From);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const backendUrl = process.env.NGROK_URL || process.env.BACKEND_URL;
    if (!backendUrl) {
      this.logger.error('BACKEND_URL not configured — inbound voice webhook cannot route');
      res.type('text/xml');
      res.send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Configuration error</Say></Response>',
      );
      return;
    }
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    response.say({ language: 'pt-BR', voice: 'Polly.Camila' }, 'Assistente de vendas conectado.');

    const start = response.start();
    start.stream({ url: `${wsUrl}/ws/media`, track: 'both_tracks' });
    response.pause({ length: 3600 });

    res.type('text/xml');
    res.send(response.toString());
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle()
  @Post('webhook/recording/:callId')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleRecordingWebhook(
    @Param('callId') callId: string,
    @Body()
    body: {
      RecordingSid?: string;
      RecordingUrl?: string;
      RecordingStatus?: string;
      RecordingDuration?: string;
    },
  ) {
    this.logger.log(`Recording webhook for call ${callId}: status=${body.RecordingStatus}`);
    if (body.RecordingUrl && body.RecordingStatus === 'completed') {
      await this.callsService.handleRecordingCompleted(
        callId,
        body.RecordingUrl,
        parseInt(body.RecordingDuration || '0', 10),
      );
    }
    return { success: true };
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle()
  @Post('webhook/status/:callId')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleStatusWebhook(
    @Param('callId') callId: string,
    @Body() body: { CallStatus: string; CallDuration?: string; CallSid?: string },
  ) {
    const duration = body.CallDuration ? parseInt(body.CallDuration, 10) : undefined;
    await this.callsService.handleStatusWebhook(callId, body.CallStatus, duration);
    return { success: true };
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle()
  @Post('webhook/status')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleStatusWebhookGlobal(
    @Body() body: { CallStatus: string; CallDuration?: string; CallSid: string },
  ) {
    const duration = body.CallDuration ? parseInt(body.CallDuration, 10) : undefined;
    await this.callsService.handleStatusWebhookBySid(body.CallSid, body.CallStatus, duration);
    return { success: true };
  }

  @Public()
  @UseGuards(TwilioSignatureGuard)
  @SkipThrottle()
  @Post('webhook/transcription/:callId')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleTranscriptionWebhook(
    @Param('callId') callId: string,
    @Body() body: { TranscriptionText?: string },
  ) {
    if (body.TranscriptionText) {
      // Validate call exists before updating (prevents update on guessed IDs)
      const call = await this.callsService.findCallById(callId);
      if (call) {
        await this.callsService.update(callId, call.companyId, {
          transcript: body.TranscriptionText,
        });
      } else {
        this.logger.warn(`Transcription webhook for unknown call: ${callId}`);
      }
    }
    return { success: true };
  }

  @Post(':companyId/:id/analyze')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Analyze call transcript with AI',
    description:
      'Performs sentiment analysis and generates actionable insights from call transcript',
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis completed successfully',
  })
  async analyzeCall(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.callsService.analyzeCall(id, companyId, req.user.id);
  }

  @Get(':companyId/export')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Export all calls as CSV',
    description:
      'Returns CSV export of all calls including date, phone, direction, status, duration, sentiment, and AI suggestions count',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV export generated successfully',
  })
  async exportCalls(@Param('companyId') companyId: string, @Res() res: Response) {
    const csv = await this.callsService.exportCallsAsCsv(companyId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="calls-export-${Date.now()}.csv"`,
    });
    res.send(csv);
  }
}
