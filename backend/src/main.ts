import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({ origin: allowedOrigins });

  // Auth routes live at /auth/... (no api prefix) so Yahoo's redirect URI is clean
  app.setGlobalPrefix('api', { exclude: ['auth/(.*)'] });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
