import { Injectable, Logger } from '@nestjs/common';
import type { AggregatedData, AggregatedUser, GoogleChatEvent } from '../domain/report.types';
import { ChatDeliveryService } from '../infrastructure/chat-delivery.service';
import { JiraApiService } from '../infrastructure/jira-api.service';
import { ReportConfigService } from '../infrastructure/report-config.service';

@Injectable()
export class ReportRunnerService {
  private readonly logger = new Logger(ReportRunnerService.name);

  constructor(
    private readonly configService: ReportConfigService,
    private readonly jiraApiService: JiraApiService,
    private readonly chatDeliveryService: ChatDeliveryService,
  ) {}

  async runDailyReport(source: string) {
    const cfg = this.configService.getRuntimeConfig();
    const debugEnabled = this.isAggregationDebugEnabled();
    const issues = await this.jiraApiService.fetchIssuesWithWorklogs(cfg.jira, debugEnabled);
    const data = this.aggregateByReportDate(issues, cfg.reportDate, cfg.timezone);

    await this.chatDeliveryService.sendReport(
      cfg.chat,
      {
        ...data,
        reportDateTimeLabel: cfg.reportDateTimeLabel,
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
        text: 'Da gui lai report thanh cong.',
      };
    }

    if (eventType === 'ADDED_TO_SPACE') {
      return {
        text: 'Logwork bot da ket noi. Ban co the bam "Kiem tra lai" tren card report de gui lai bao cao.',
      };
    }

    return {
      text: 'OK',
    };
  }

  canTriggerWithToken(token: string): boolean {
    return this.configService.canTriggerWithToken(token);
  }

  private aggregateByReportDate(
    issues: Array<{ key?: string; fields?: { worklog?: { worklogs?: Array<any> } } }>,
    reportDate: string,
    timezone: string,
  ): AggregatedData {
    const users: Record<string, AggregatedUser> = {};
    const debugEnabled = this.isAggregationDebugEnabled();
    const debugAuthorFilters = this.getDebugAuthorFilters();

    if (debugEnabled) {
      this.logger.log(
        `Aggregation debug enabled for reportDate=${reportDate}, timezone=${timezone}, authorFilters=${debugAuthorFilters.join(',') || 'none'}`,
      );
    }

    for (const issue of issues) {
      const issueKey = issue?.key || 'UNKNOWN_ISSUE';
      const logs = issue?.fields?.worklog?.worklogs || [];

      for (const worklog of logs) {
        this.aggregateSingleWorklog({
          worklog,
          issueKey,
          reportDate,
          timezone,
          users,
          debugEnabled,
          debugAuthorFilters,
        });
      }
    }

    if (debugEnabled) {
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

    return { users, reportDate };
  }

  private aggregateSingleWorklog(params: {
    worklog: any;
    issueKey: string;
    reportDate: string;
    timezone: string;
    users: Record<string, AggregatedUser>;
    debugEnabled: boolean;
    debugAuthorFilters: string[];
  }): void {
    const { worklog, issueKey, reportDate, timezone, users, debugEnabled, debugAuthorFilters } = params;
    const startedDate = new Date(worklog.started);
    const startedLocalDate = this.formatDateInTimeZone(startedDate, timezone);
    const startedLocalTime = this.formatTimeInTimeZone(startedDate, timezone);
    const name = this.normalizeAuthorName(worklog?.author?.displayName || 'Unknown');
    const seconds = worklog.timeSpentSeconds || 0;

    if (debugEnabled && this.shouldLogDebugForAuthor(debugAuthorFilters, name)) {
      const hours = seconds / 3600;
      this.logger.log(
        `Worklog issue=${issueKey}, id=${String(worklog?.id || 'UNKNOWN_WORKLOG')}, author=${name}, startedRaw=${String(worklog?.started || '')}, localDate=${startedLocalDate}, localTime=${startedLocalTime}, reportDate=${reportDate}, seconds=${seconds}, hours=${hours}`,
      );
    }

    if (startedLocalDate !== reportDate) {
      if (debugEnabled && this.shouldLogDebugForAuthor(debugAuthorFilters, name)) {
        this.logger.log(
          `Skipped worklog issue=${issueKey}, id=${String(worklog?.id || 'UNKNOWN_WORKLOG')}, author=${name} because localDate=${startedLocalDate} != reportDate=${reportDate}`,
        );
      }
      return;
    }

    if (!users[name]) {
      users[name] = { logs: {} };
    }

    users[name].logs[startedLocalDate] = (users[name].logs[startedLocalDate] || 0) + seconds;
  }

  private isAggregationDebugEnabled(): boolean {
    const value = (process.env.REPORT_DEBUG || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private getDebugAuthorFilters(): string[] {
    const raw = (process.env.REPORT_DEBUG_AUTHORS || '').trim();
    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map((item) => this.normalizeAuthorName(item).toLowerCase())
      .filter(Boolean);
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

  private formatDateInTimeZone(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private formatTimeInTimeZone(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }

  private formatHoursFromSeconds(totalSeconds: number): string {
    const hours = totalSeconds / 3600;
    return `${String(hours)}h`;
  }
}
