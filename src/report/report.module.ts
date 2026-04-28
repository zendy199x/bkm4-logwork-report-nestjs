import { Module } from '@nestjs/common';

import { ReportController } from './report.controller';
import { ReportScheduler } from './report.scheduler';
import { ReportService } from './report.service';

const schedulerProviders = process.env.VERCEL ? [] : [ReportScheduler];

@Module({
  controllers: [ReportController],
  providers: [ReportService, ...schedulerProviders],
  exports: [ReportService],
})
export class ReportModule { }
