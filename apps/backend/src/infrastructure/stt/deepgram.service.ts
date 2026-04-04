import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import WebSocket = require('ws');
import { CircuitBreaker } from '../../common/resilience/circuit-breaker';

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface LiveSession {
  send: (audio: Buffer) => void;
  finish: () => void;
  isReady: () => boolean;
}

@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);
  private readonly apiKey: string | null = null;
  private readonly breaker: CircuitBreaker;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('DEEPGRAM_API_KEY');
    if (key) {
      this.apiKey = key;
      this.logger.log('✅ Deepgram client initialized');
    } else {
      this.logger.warn('⚠️ Deepgram API key not configured');
    }

    // Circuit breaker for HTTP calls (Release It! - Integration Points)
    this.breaker = new CircuitBreaker({
      name: 'Deepgram',
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      callTimeoutMs: 30000, // transcription can take longer
    });
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  createLiveSession(
    onTranscript: (result: TranscriptionResult) => void,
    onError?: (error: unknown) => void,
  ): LiveSession {
    if (!this.apiKey) {
      throw new Error('Deepgram not configured');
    }

    let isOpen = false;
    const audioBuffer: Buffer[] = [];

    const url =
      'wss://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&encoding=mulaw&sample_rate=8000&channels=1&punctuate=true&interim_results=true&endpointing=200';

    const ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    ws.on('open', () => {
      this.logger.log('🎙️ Deepgram live session OPENED (raw ws)');
      isOpen = true;

      if (audioBuffer.length > 0) {
        this.logger.log(`Flushing ${audioBuffer.length} buffered audio chunks`);
        for (const chunk of audioBuffer) {
          try {
            ws.send(chunk);
          } catch (_) {}
        }
        audioBuffer.length = 0;
      }
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'Results') {
          const alt = msg.channel?.alternatives?.[0];
          if (!alt?.transcript) return;

          onTranscript({
            text: alt.transcript,
            isFinal: msg.is_final || false,
            confidence: alt.confidence || 0,
            words: alt.words,
          });
        }
      } catch (_) {}
    });

    ws.on('error', (error: Error) => {
      this.logger.error('Deepgram WS error:', error.message);
      isOpen = false;
      onError?.(error);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.logger.log(`🎙️ Deepgram live session closed: code=${code}`);
      isOpen = false;
    });

    return {
      send: (audio: Buffer) => {
        if (isOpen && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(audio);
          } catch (_) {}
        } else if (audioBuffer.length < 200) {
          audioBuffer.push(audio);
        }
      },
      finish: () => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        } catch (_) {}
      },
      isReady: () => isOpen,
    };
  }

  async transcribeUrl(url: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Deepgram not configured');
    }

    return this.breaker.execute(async () => {
      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&punctuate=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        },
      );

      if (!response.ok) {
        throw new Error(`Deepgram error: ${response.status}`);
      }

      const result = (await response.json()) as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>;
          }>;
        };
      };
      return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    });
  }

  /** Expose circuit breaker state for /health endpoint */
  getCircuitBreakerStatus() {
    return this.breaker.getHealthInfo();
  }
}
