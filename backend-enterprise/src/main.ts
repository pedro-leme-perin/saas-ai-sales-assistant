import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { MediaStreamsGateway } from './modules/calls/media-streams.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // CORS Configuration
  app.enableCors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://saas-ai-sales-assistant-oc6b.vercel.app',
    configService.get('FRONTEND_URL', 'http://localhost:3000'),
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});
```

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não definidas no DTO
      forbidNonWhitelisted: true, // Throw error se receber propriedades extras
      transform: true, // Transforma payloads em instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true, // Conversão automática de tipos
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'], // Health check sem prefixo /api
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('SaaS AI Sales Assistant API')
    .setDescription('API para assistente de vendas com IA - Ligações e WhatsApp')
    .setVersion('1.0')
    .addTag('auth', 'Autenticação e autorização')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('companies', 'Gerenciamento de empresas')
    .addTag('calls', 'Gerenciamento de ligações')
    .addTag('whatsapp', 'Gerenciamento de WhatsApp')
    .addTag('ai', 'Sugestões de IA')
    .addTag('billing', 'Faturamento e assinaturas')
    .addTag('notifications', 'Notificações')
    .addTag('analytics', 'Analytics e métricas')
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
    .addServer('https://api.production.com', 'Produção (quando disponível)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SaaS AI Sales - API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .information-container { margin: 50px 0 }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  // Start server
  const port = configService.get('PORT', 3001);
  await app.listen(port);

  // Init raw WebSocket for Twilio Media Streams
  const httpServer = app.getHttpServer();
  const mediaGateway = app.get(MediaStreamsGateway);
  mediaGateway.init(httpServer);

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║        🚀  SaaS AI Sales Assistant API  🚀            ║');
  console.log('║                                                        ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║                                                        ║');
  console.log(`║  📍 Environment: development                           ║`);
  console.log(`║  🌐 Server:      http://localhost:${port}                 ║`);
  console.log(`║  ❤️  Health:      http://localhost:${port}/health         ║`);
  console.log(`║  📚 API Docs:    http://localhost:${port}/api/docs       ║`);
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
}

bootstrap();

