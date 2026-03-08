import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { MediaStreamsGateway } from './modules/calls/media-streams.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://saas-ai-sales-assistant-oc6b.vercel.app',
      'https://saas-ai-sales-assistant.vercel.app',
      configService.get('FRONTEND_URL', 'http://localhost:3000'),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
    .setDescription('API para assistente de vendas com IA - Ligacoes e WhatsApp')
    .setVersion('1.0')
    .addTag('auth', 'Autenticacao e autorizacao')
    .addTag('users', 'Gerenciamento de usuarios')
    .addTag('companies', 'Gerenciamento de empresas')
    .addTag('calls', 'Gerenciamento de ligacoes')
    .addTag('whatsapp', 'Gerenciamento de WhatsApp')
    .addTag('ai', 'Sugestoes de IA')
    .addTag('billing', 'Faturamento e assinaturas')
    .addTag('notifications', 'Notificacoes')
    .addTag('analytics', 'Analytics e metricas')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT do Clerk',
      },
      'JWT',
    )
    .addServer('http://localhost:3001', 'Desenvolvimento Local')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SaaS AI Sales - API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
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
  httpServer.on('upgrade', (request: any, socket: any, head: Buffer) => {
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

  console.log(`Server running on http://localhost:${port}`);
  console.log(`API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
