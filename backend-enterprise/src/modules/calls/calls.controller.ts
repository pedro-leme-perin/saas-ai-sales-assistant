import { Controller, Get, Post, Put, Param, Body, Res, HttpCode, Request, Logger } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { Response } from 'express';
import * as twilio from 'twilio';

@ApiTags('Calls')
@Controller('calls')
export class CallsController {
  private readonly logger = new Logger(CallsController.name);

  constructor(private readonly callsService: CallsService) {}

  @Get(':companyId')
  async findAll(@Param('companyId') companyId: string) {
    return this.callsService.findAll(companyId);
  }

  @Get(':companyId/stats')
  @ApiOperation({ summary: 'Get call statistics' })
  async getStats(@Param('companyId') companyId: string) {
    return this.callsService.getCallStats(companyId);
  }

  @Get(':companyId/:id')
  async findOne(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.callsService.findOne(id, companyId);
  }

  @Post(':companyId')
  async create(
    @Param('companyId') companyId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.callsService.create(companyId, req.user.id, data);
  }

  @Put(':companyId/:id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.callsService.update(id, companyId, data);
  }

  @Post(':companyId/initiate')
  @ApiOperation({ summary: 'Initiate outbound call via Twilio' })
  async initiateCall(
    @Param('companyId') companyId: string,
    @Body() data: { phoneNumber: string },
    @Request() req: any,
  ) {
    const webhookUrl = process.env.NGROK_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    return this.callsService.initiateCall(
      companyId,
      req.user.id,
      data.phoneNumber,
      webhookUrl,
    );
  }

  @Post(':companyId/:id/end')
  @ApiOperation({ summary: 'End an active call' })
  async endCall(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.callsService.endCall(id, companyId);
  }

  // =====================================================
  // TWILIO WEBHOOKS
  // =====================================================

  @Public()
  @Post('webhook/voice/:callId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio voice webhook - returns TwiML with Media Streams' })
  async handleVoiceWebhook(
    @Param('callId') callId: string,
    @Res() res: Response,
  ) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const backendUrl = process.env.NGROK_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    this.logger.log(`Voice webhook called for call: ${callId}`);
    this.logger.log(`Backend URL: ${backendUrl}`);
    this.logger.log(`WebSocket URL: ${wsUrl}/ws/media`);

    // Say something first so call stays alive even if stream fails
    response.say(
      { language: 'pt-BR', voice: 'Polly.Camila' },
      'Conectando assistente de vendas.',
    );

    // Then connect Media Streams
    const connect = response.connect();
    connect.stream({
      url: `${wsUrl}/ws/media`,
      track: 'both_tracks',
    });

    // Fallback: keep call alive with a long pause if stream disconnects
    response.pause({ length: 3600 });

    const twiml = response.toString();
    this.logger.log(`TwiML generated: ${twiml}`);

    res.type('text/xml');
    res.send(twiml);
  }

  @Public()
  @Post('webhook/voice')
  @HttpCode(200)
  async handleVoiceWebhookInbound(
    @Body() body: { CallSid: string; From: string; To: string },
    @Res() res: Response,
  ) {
    this.logger.log(`Inbound voice webhook: CallSid=${body.CallSid} From=${body.From}`);
    await this.callsService.findOrCreateByCallSid(body.CallSid, body.From);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const backendUrl = process.env.NGROK_URL || process.env.BACKEND_URL || 'http://localhost:3001';
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    response.say(
      { language: 'pt-BR', voice: 'Polly.Camila' },
      'Conectando assistente de vendas.',
    );

    const connect = response.connect();
    connect.stream({ url: `${wsUrl}/ws/media` });
    response.pause({ length: 3600 });

    res.type('text/xml');
    res.send(response.toString());
  }

  @Public()
  @Post('webhook/status/:callId')
  @HttpCode(200)
  async handleStatusWebhook(
    @Param('callId') callId: string,
    @Body() body: { CallStatus: string; CallDuration?: string; CallSid?: string },
  ) {
    const duration = body.CallDuration ? parseInt(body.CallDuration, 10) : undefined;
    await this.callsService.handleStatusWebhook(callId, body.CallStatus, duration);
    return { success: true };
  }

  @Public()
  @Post('webhook/status')
  @HttpCode(200)
  async handleStatusWebhookGlobal(
    @Body() body: { CallStatus: string; CallDuration?: string; CallSid: string },
  ) {
    const duration = body.CallDuration ? parseInt(body.CallDuration, 10) : undefined;
    await this.callsService.handleStatusWebhookBySid(body.CallSid, body.CallStatus, duration);
    return { success: true };
  }

  @Public()
  @Post('webhook/transcription/:callId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fallback transcription webhook (post-call)' })
  async handleTranscriptionWebhook(
    @Param('callId') callId: string,
    @Body() body: { TranscriptionText?: string },
  ) {
    if (body.TranscriptionText) {
      await this.callsService.update(callId, '', {
        transcript: body.TranscriptionText,
      });
    }
    return { success: true };
  }

  @Post(':companyId/:id/analyze')
  @ApiOperation({ summary: 'Analyze call transcript with AI' })
  async analyzeCall(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.callsService.analyzeCall(id, companyId, req.user.id);
  }
}
