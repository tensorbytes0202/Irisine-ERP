import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { assertProductionConfig, securityHeaders } from './common/security';

async function bootstrap() {
  assertProductionConfig(process.env);
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api/v1');

  // Behind a reverse proxy the real client IP is needed, or rate limits count the proxy as one user.
  if (process.env.TRUST_PROXY) (app.getHttpAdapter().getInstance() as any).set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.use(securityHeaders);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || ['http://localhost:3000'],
    credentials: true,
  });

  // The API map is for developers: never published on a production server.
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Irisine Classrooms API')
      .setDescription('Integrated Learning & School Management System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
