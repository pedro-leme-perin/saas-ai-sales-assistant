// =============================================
// 📞 TWILIO WEBHOOK CONTROLLER
// =============================================

import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Headers } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { EventEmitter2 } from '@nestjs/event-emitter';

@ApiTags('Webhooks')
@Controller('webhooks/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post('voice')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleVoiceWebhook(@Body() body: any, @Headers('x-twilio-signature') signature: string) {
    this.logger.log(`Twilio voice webhook: ${body?.CallStatus}`);

    // Emit event for call processing
    this.eventEmitter.emit('twilio.call.status', {
      callSid: body?.CallSid,
      status: body?.CallStatus,
      from: body?.From,
      to: body?.To,
      duration: body?.CallDuration,
      recordingUrl: body?.RecordingUrl,
    });

    // Return TwiML response
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Bem-vindo ao assistente de vendas com inteligência artificial.</Say>
  <Record maxLength="3600" transcribe="true" transcribeCallback="/webhooks/twilio/transcription" />
</Response>`;
  }

  @Post('status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleStatusCallback(@Body() body: any) {
    this.logger.log(`Call status update: ${body?.CallSid} - ${body?.CallStatus}`);

    this.eventEmitter.emit('twilio.call.status-update', {
      callSid: body?.CallSid,
      status: body?.CallStatus,
      duration: body?.CallDuration,
      timestamp: new Date().toISOString(),
    });

    return { received: true };
  }

  @Post('transcription')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleTranscription(@Body() body: any) {
    this.logger.log(`Transcription received for: ${body?.CallSid}`);

    this.eventEmitter.emit('twilio.transcription', {
      callSid: body?.CallSid,
      transcriptionText: body?.TranscriptionText,
      transcriptionSid: body?.TranscriptionSid,
      recordingSid: body?.RecordingSid,
    });

    return { received: true };
  }

  @Post('recording')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleRecording(@Body() body: any) {
    this.logger.log(`Recording ready: ${body?.RecordingSid}`);

    this.eventEmitter.emit('twilio.recording', {
      callSid: body?.CallSid,
      recordingSid: body?.RecordingSid,
      recordingUrl: body?.RecordingUrl,
      duration: body?.RecordingDuration,
    });

    return { received: true };
  }
}
