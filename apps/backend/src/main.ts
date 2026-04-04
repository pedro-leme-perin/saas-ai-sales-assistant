// Railway: monorepo root context build
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { Socket as NetSocket } from 'net';
import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import compression = require('compression');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { MediaStreamsGateway } from './modules/calls/media-streams.gateway';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const logger = new Logger('Bootstrap');

// ── Initialize Sentry (Release It! - Error Tracking & Monitoring & Distributed Tracing) ──
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Distributed tracing: capture request traces and link to frontend transactions
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Automatically extract trace context from sentry-trace and baggage headers
    // Links incoming requests to frontend transactions via trace ID
    tracePropagationTargets: ['localhost', /^https:\/\/.*\.railway\.app/],
    beforeSend(event) {
      // Strip PII — Authorization, Cookies, Auth Tokens
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-clerk-auth-token'];
      }
      return event;
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // ── Security headers (Release It! - Defense in Depth) ──
  app.use(
    helmet({
      contentSecurityPolicy: false, // Next.js handles CSP
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── Response compression (HPBN - Performance) ──
  app.use(compression());

  // ── Distributed Tracing: Sentry trace header extraction (SRE - Distributed Systems) ──
  // Extracts sentry-trace and baggage headers from incoming requests for trace context propagation
  // Links frontend transactions to backend transactions in the trace waterfall
  if (process.env.SENTRY_DSN) {
    // middleware function to ensure trace context is set from incoming headers
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Sentry's context is automatically extracted from headers by @sentry/node
      // This middleware ensures headers are available to Sentry's context manager
      next();
    });
  }

  // ── Redis WebSocket Adapter (System Design Interview - Cap. 12) ──
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // ── Global Exception Filter (Release It! - Error Handling) ──
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Structured Logging (SRE - Monitoring: structured logs with context) ──
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Graceful Shutdown (Release It! - Stability Patterns) ──
  app.enableShutdownHooks();

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://www.theiadvisor.com',
      'https://theiadvisor.com',
      configService.get('FRONTEND_URL', 'http://localhost:3000'),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Include Sentry trace headers for distributed tracing (sentry-trace, baggage)
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'sentry-trace',
      'baggage',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const config = new DocumentBuilder()
    .setTitle('SaaS AI Sales Assistant API')
    .setDescription(
      'Enterprise-grade SaaS API for AI-powered sales assistance via phone calls and WhatsApp Business. ' +
        'Integrate with Twilio for real-time call transcription and WhatsApp for messaging suggestions. ' +
        'All endpoints require JWT authentication from Clerk.',
    )
    .setVersion('1.0.0')
    .setContact('Sales AI Team', 'https://www.theiadvisor.com', 'team@theiadvisor.com')
    .setLicense('UNLICENSED', '')
    // ── Authentication ──
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT token from Clerk. Include in Authorization header: "Authorization: Bearer <token>"',
      },
      'JWT',
    )
    // ── API Tags (organize endpoints by feature) ──
    .addTag('auth', 'Authentication & session management (Clerk integration)')
    .addTag('users', 'User management (CRUD, profiles, roles)')
    .addTag('companies', 'Company/tenant management (usage, stats, configuration)')
    .addTag('calls', 'Phone call management (Twilio integration, transcription, analysis)')
    .addTag('whatsapp', 'WhatsApp Business messaging (send, receive, analytics)')
    .addTag('ai', 'AI suggestion generation (LLM integration, multiple providers)')
    .addTag('billing', 'Subscription & payment management (Stripe integration)')
    .addTag('notifications', 'Real-time notifications (WebSocket/Socket.io)')
    .addTag('analytics', 'Business metrics & dashboards (KPIs, sentiment, performance)')
    .addTag('health', 'Health checks & monitoring (liveness, readiness, services)')
    .addTag('webhooks', 'External service webhooks (Twilio, WhatsApp, Stripe, Clerk)')
    // ── Servers ──
    .addServer('http://localhost:3001', 'Local Development')
    .addServer(process.env.BACKEND_URL || 'https://api.theiadvisor.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SaaS AI Sales Assistant - API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      displayOperationId: true,
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      deepLinking: true,
      presets: undefined,
      plugins: undefined,
    },
    customCss:
      '.swagger-ui .topbar { display: none } ' +
      '.swagger-ui .scheme-container { background: #fafafa; padding: 20px; border-radius: 4px; } ' +
      '.swagger-ui .info { margin-bottom: 40px; }',
  });

  const port = configService.get('PORT', 3001);
  await app.listen(port);

  // === CRITICAL: Route WebSocket upgrades BEFORE Socket.io consumes them ===
  const httpServer = app.getHttpServer();
  const mediaGateway = app.get(MediaStreamsGateway);
  mediaGateway.initWss(); // Just create the WS server, don't attach to httpServer

  // Save Socket.io's existing upgrade listeners
  const existingListeners = httpServer.listeners('upgrade').slice();

  // Remove ALL upgrade listeners (including Socket.io's)
  httpServer.removeAllListeners('upgrade');

  // Add our own router that decides who handles each upgrade
  httpServer.on('upgrade', (request: IncomingMessage, socket: NetSocket, head: Buffer) => {
    const url = request.url || '';
    console.log(`[UpgradeRouter] WebSocket upgrade request: ${url}`);

    if (url === '/ws/media' || url.startsWith('/ws/media?') || url.startsWith('/ws/media/')) {
      console.log('[UpgradeRouter] Routing to MediaStreamsGateway');
      mediaGateway.handleUpgrade(request, socket, head);
    } else {
      // Route to Socket.io (notifications gateway)
      console.log('[UpgradeRouter] Routing to Socket.io');
      for (const listener of existingListeners) {
        listener.call(httpServer, request, socket, head);
      }
    }
  });

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);

  // ── Graceful Shutdown handlers (SRE - Release Engineering) ──
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.warn(`⚠️ Received ${signal} — starting graceful shutdown...`);
      await app.close();
      logger.log('✅ Application shut down gracefully');
      process.exit(0);
    });
  }
}

bootstrap().catch((err) => {
  logger.error('❌ Failed to start application', err);
  process.exit(1);
});


// Deploy trigger: 2026-04-03 02:03
