// src/infrastructure/stt/deepgram.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, DeepgramClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);
  private readonly client: DeepgramClient | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPGRAM_API_KEY');

    if (apiKey) {
      this.client = createClient(apiKey);
      this.logger.log('✅ Deepgram client initialized');
    } else {
      this.logger.warn('⚠️ Deepgram API key not configured');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Create a live transcription session for streaming audio
   * Returns a connection that accepts raw audio chunks
   */
  createLiveSession(
    onTranscript: (result: TranscriptionResult) => void,
    onError?: (error: Error) => void,
  ) {
    if (!this.client) {
      throw new Error('Deepgram not configured');
    }

    const connection = this.client.listen.live({
      model: 'nova-2',
      language: 'pt-BR',          // Portuguese Brazil
      smart_format: true,
      interim_results: true,       // Get partial results in real-time
      utterance_end_ms: 1000,      // End of utterance detection
      vad_events: true,            // Voice activity detection
      encoding: 'mulaw',           // Twilio uses mulaw encoding
      sample_rate: 8000,           // Twilio uses 8kHz
      channels: 1,
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
      this.logger.log('🎙️ Deepgram live session opened');
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript?.transcript) return;

      onTranscript({
        text: transcript.transcript,
        isFinal: data.is_final || false,
        confidence: transcript.confidence || 0,
        words: transcript.words,
      });
    });

    connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      this.logger.error('Deepgram error:', error);
      onError?.(error);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      this.logger.log('🎙️ Deepgram live session closed');
    });

    return connection;
  }

  /**
   * Transcribe a recording URL (post-call)
   */
  async transcribeUrl(url: string): Promise<string> {
    if (!this.client) {
      throw new Error('Deepgram not configured');
    }

    const { result, error } = await this.client.listen.prerecorded.transcribeUrl(
      { url },
      {
        model: 'nova-2',
        language: 'pt-BR',
        smart_format: true,
        punctuate: true,
      },
    );

    if (error) throw error;

    return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }
}
