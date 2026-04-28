import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3000);

  await app.listen(port, '0.0.0.0');
  Logger.log(`HTTP server is running on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error('Application failed to start', error, 'Bootstrap');
  process.exitCode = 1;
});
