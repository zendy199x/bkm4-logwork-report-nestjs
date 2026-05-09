import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ReportService } from './report/report.service';

export async function runCron() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const reportService = app.get(ReportService);
    await reportService.runDailyReport('render-cron-job');
    Logger.log('Cron job executed successfully', 'CronRunner');
  } finally {
    await app.close();
  }
}

runCron().catch((error) => {
  Logger.error('Cron job failed', error, 'CronRunner');
  process.exitCode = 1;
});
