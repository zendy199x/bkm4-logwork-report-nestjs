import { Module } from '@nestjs/common';

import { ReportController } from './report.controller';
import { ReportScheduler } from './report.scheduler';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, ReportScheduler],
  exports: [ReportService],
})
export class ReportModule {}
