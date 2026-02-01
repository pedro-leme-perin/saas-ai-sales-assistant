import { Controller, Get, Post, Put, Param, Body, Req, Res, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { Request, Response } from 'express';
import * as twilio from 'twilio';

@ApiTags('Calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get(':companyId')
  async findAll(@Param('companyId') companyId: string) {
    return this.callsService.findAll(companyId);
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
  ) {
    return this.callsService.create(companyId, data);
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
    @Body() data: { userId: string; phoneNumber: string; webhookUrl?: string },
  ) {
    const webhookUrl = data.webhookUrl || process.env.BACKEND_URL || 'http://localhost:3001';
    return this.callsService.initiateCall(
      companyId,
      data.userId,
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

  @Get(':companyId/stats')
  @ApiOperation({ summary: 'Get call statistics' })
  async getStats(@Param('companyId') companyId: string) {
    return this.callsService.getCallStats(companyId);
  }

  // Twilio Webhooks (não autenticados - Twilio chama diretamente)
  @Post('webhook/voice/:callId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio voice webhook - returns TwiML' })
  async handleVoiceWebhook(
    @Param('callId') callId: string,
    @Res() res: Response,
  ) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Mensagem inicial da chamada
    response.say(
      { voice: 'Polly.Camila', language: 'pt-BR' },
      'Olá! Esta é uma chamada do sistema de vendas. Por favor, aguarde enquanto conectamos você.',
    );

    // Gravar a chamada para transcrição posterior
    response.record({
      transcribe: true,
      transcribeCallback: `/api/calls/webhook/transcription/${callId}`,
      maxLength: 3600, // 1 hora máximo
      playBeep: false,
    });

    res.type('text/xml');
    res.send(response.toString());
  }

  @Post('webhook/status/:callId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio status callback webhook' })
  async handleStatusWebhook(
    @Param('callId') callId: string,
    @Body() body: { CallStatus: string; CallDuration?: string },
  ) {
    const duration = body.CallDuration ? parseInt(body.CallDuration, 10) : undefined;
    await this.callsService.handleStatusWebhook(callId, body.CallStatus, duration);
    return { success: true };
  }

  @Post('webhook/transcription/:callId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio transcription callback webhook' })
  async handleTranscriptionWebhook(
    @Param('callId') callId: string,
    @Body() body: { TranscriptionText?: string },
  ) {
    if (body.TranscriptionText) {
      // Aqui você pode salvar a transcrição e gerar sugestões de IA
      console.log(`Transcription for call ${callId}: ${body.TranscriptionText}`);
    }
    return { success: true };
  }
}