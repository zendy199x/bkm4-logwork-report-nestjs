import { Module } from '@nestjs/common';

import { ReportRunnerService } from './application/report-runner.service';
import { ChatDeliveryService } from './infrastructure/chat-delivery.service';
import { JiraApiService } from './infrastructure/jira-api.service';
import { ReportConfigService } from './infrastructure/report-config.service';
import { ReportController } from './report.controller';
import { ReportScheduler } from './report.scheduler';
import { ReportService } from './report.service';

const schedulerProviders = process.env.VERCEL ? [] : [ReportScheduler];

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportRunnerService,
    JiraApiService,
    ChatDeliveryService,
    ReportConfigService,
    ...schedulerProviders,
  ],
  exports: [ReportService],
})
export class ReportModule { }
