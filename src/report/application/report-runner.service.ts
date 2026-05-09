import { Inject, Injectable, Logger } from '@nestjs/common';
import { ReportAggregationService } from '../domain/report-aggregation.service';
import {
    CHAT_GATEWAY_PORT,
    JIRA_GATEWAY_PORT,
    REPORT_CONFIG_PORT,
    type ChatGatewayPort,
    type JiraGatewayPort,
    type ReportConfigPort,
} from '../domain/report.ports';
import type { GoogleChatEvent } from '../domain/report.types';
import { ReportDate, Timezone } from '../domain/value-objects';

@Injectable()
export class ReportRunnerService {
  private readonly logger = new Logger(ReportRunnerService.name);

  constructor(
    @Inject(REPORT_CONFIG_PORT)
    private readonly configService: ReportConfigPort,
    @Inject(JIRA_GATEWAY_PORT)
    private readonly jiraGateway: JiraGatewayPort,
    @Inject(CHAT_GATEWAY_PORT)
    private readonly chatGateway: ChatGatewayPort,
    private readonly aggregationService: ReportAggregationService,
  ) {}

  async runDailyReport(source: string) {
    const cfg = this.configService.getRuntimeConfig();
    const reportDate = ReportDate.from(cfg.reportDate);
    const timezone = Timezone.from(cfg.timezone);
    const issues = await this.jiraGateway.fetchIssuesWithWorkLogs(
      cfg.jira,
      cfg.jiraQuery,
      cfg.aggregationDebug.enabled,
    );
    const data = this.aggregationService.aggregateByReportDate(issues, reportDate, timezone);

    this.logAggregationSummary(
      cfg.aggregationDebug.enabled,
      cfg.aggregationDebug.authorFilters,
      data.users,
      reportDate.value,
      timezone.value,
    );

    await this.chatGateway.sendReport(
      cfg.chat,
      {
        ...data,
        reportDateTimeLabel: cfg.reportDateTimeLabel,
        reportTitle: cfg.reportTitle,
      },
      cfg.jiraCheckUrl,
    );

    const userCount = Object.values(data.users).filter((user) => (user.logs[cfg.reportDate] || 0) > 0)
      .length;

    const totalSeconds = Object.values(data.users).reduce(
      (sumSeconds, user) => sumSeconds + (user.logs[cfg.reportDate] || 0),
      0,
    );

    const summary = {
      source,
      reportDate: cfg.reportDate,
      totalHours: this.formatHoursFromSeconds(totalSeconds),
      userCount,
    };

    this.logger.log(
      `Report sent: source=${summary.source}, date=${summary.reportDate}, users=${summary.userCount}, total=${summary.totalHours}`,
    );

    return summary;
  }

  async handleGoogleChatEvent(event: unknown): Promise<Record<string, unknown>> {
    const chatEvent = (event || {}) as GoogleChatEvent & {
      common?: { invokedFunction?: string };
      commonEventObject?: { invokedFunction?: string };
    };
    const eventType = (chatEvent.type || '').toUpperCase();

    const invokedFunction =
      chatEvent.common?.invokedFunction ||
      chatEvent.commonEventObject?.invokedFunction ||
      chatEvent.action?.actionMethodName ||
      '';

    if (eventType === 'CARD_CLICKED' && this.configService.isRetryAction(invokedFunction)) {
      await this.runDailyReport('google-chat-action-retry');
      return {
        actionResponse: {
          type: 'NEW_MESSAGE',
        },
        text: 'Report has been sent again successfully.',
      };
    }

    if (eventType === 'ADDED_TO_SPACE') {
      return {
        text: 'Work log tracking bot is connected. You can press "Retry" on the report card to send the report again.',
      };
    }

    return {
      text: 'OK',
    };
  }

  canTriggerWithToken(token: string): boolean {
    return this.configService.canTriggerWithToken(token);
  }

  private logAggregationSummary(
    debugEnabled: boolean,
    debugAuthorFilters: string[],
    users: Record<string, { logs: Record<string, number> }>,
    reportDate: string,
    timezone: string,
  ): void {
    if (debugEnabled) {
      this.logger.log(
        `Aggregation debug enabled for reportDate=${reportDate}, timezone=${timezone}, authorFilters=${debugAuthorFilters.join(',') || 'none'}`,
      );
      const debugRows = Object.entries(users)
        .map(([name, user]) => ({
          name,
          seconds: user.logs[reportDate] || 0,
        }))
        .filter((row) => row.seconds > 0)
        .sort((left, right) => right.seconds - left.seconds);

      for (const row of debugRows) {
        if (!this.shouldLogDebugForAuthor(debugAuthorFilters, row.name)) {
          continue;
        }

        const hours = row.seconds / 3600;
        const minuteRemainder = (row.seconds % 3600) / 60;
        this.logger.log(
          `Aggregated total author=${row.name}, reportDate=${reportDate}, seconds=${row.seconds}, hours=${hours}, hourMinute=${Math.floor(hours)}h${minuteRemainder}m`,
        );
      }
    }
  }

  private shouldLogDebugForAuthor(filters: string[], author: string): boolean {
    if (filters.length === 0) {
      return true;
    }

    return filters.includes(this.normalizeAuthorName(author).toLowerCase());
  }

  private normalizeAuthorName(rawName: string): string {
    const name = rawName.trim();
    const shortName = name.split('(')[0]?.trim();
    return shortName || name;
  }

  private formatHoursFromSeconds(totalSeconds: number): string {
    const hours = totalSeconds / 3600;
    return `${String(hours)}h`;
  }
}
