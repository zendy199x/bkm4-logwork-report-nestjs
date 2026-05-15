import { Module } from '@nestjs/common';

import { ReportRunnerService } from './application/report-runner.service';
import { ReportAggregationService } from './domain/report-aggregation.service';
import {
    CHAT_GATEWAY_PORT,
    JIRA_GATEWAY_PORT,
    LAST_REPORT_CACHE_PORT,
    REPORT_CONFIG_PORT,
} from './domain/report.ports';
import { ChatDeliveryService } from './infrastructure/chat-delivery.service';
import { JiraApiService } from './infrastructure/jira-api.service';
import { ReportConfigService } from './infrastructure/report-config.service';
import { VercelKvLastReportCacheService } from './infrastructure/vercel-kv-last-report-cache.service';
import { ReportController } from './report.controller';
import { ReportScheduler } from './report.scheduler';
import { ReportService } from './report.service';

const schedulerProviders = process.env.VERCEL ? [] : [ReportScheduler];

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportRunnerService,
    ReportAggregationService,
    JiraApiService,
    ChatDeliveryService,
    ReportConfigService,
    VercelKvLastReportCacheService,
    {
      provide: REPORT_CONFIG_PORT,
      useExisting: ReportConfigService,
    },
    {
      provide: JIRA_GATEWAY_PORT,
      useExisting: JiraApiService,
    },
    {
      provide: CHAT_GATEWAY_PORT,
      useExisting: ChatDeliveryService,
    },
    {
      provide: LAST_REPORT_CACHE_PORT,
      useExisting: VercelKvLastReportCacheService,
    },
    ...schedulerProviders,
  ],
  exports: [ReportService],
})
export class ReportModule { }
