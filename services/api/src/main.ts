import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// 允許的 CORS 來源列表 (從環境變數讀取，逗號分隔)
const getCorsOrigins = (): string[] => {
  const origins = process.env.CORS_ORIGINS;
  if (!origins || origins === '*') {
    // 開發環境預設允許常見的本地端點
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
    ];
  }
  return origins.split(',').map(o => o.trim());
};

async function bootstrap() {
  const corsOrigins = getCorsOrigins();
  
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      exposedHeaders: ['Authorization'],
    },
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('OmniBot API')
    .setDescription('Multi-tenant AI Chatbot SaaS API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health check endpoint
  app.use((req: any, res: any, next: any) => {
    if (req.path === '/health') {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } else {
      next();
    }
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 OmniBot API running on port ${port}`);
}
bootstrap();
