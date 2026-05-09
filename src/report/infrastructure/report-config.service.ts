import { Injectable, Logger } from '@nestjs/common';
import type { ReportConfigPort } from '../domain/report.ports';
import {
    ChatMode,
    type AggregationDebugConfig,
    type ChatDeliveryConfig,
    type ReportRuntimeConfig,
} from '../domain/report.types';
import { ReportDate, TeamName, Timezone } from '../domain/value-objects';

@Injectable()
export class ReportConfigService implements ReportConfigPort {
  private readonly logger = new Logger(ReportConfigService.name);
  private static readonly JIRA_REPORT_SELECTED_ITEM =
    'com.atlassian.plugins.atlassian-connect-plugin:com.gebsun.atlassian.reports.free__report';
  private static readonly JIRA_WORK_LOG_ISSUE_TYPES = [
    'Sub-Bug',
    'Sub-Env and SCM',
    'Sub-Imp',
    'Sub-Legacy Bug',
    'Sub PML',
    'Sub Project Kaizen',
    'Sub-Test',
    'Sub Skill Up',
    'Sub-task',
    'Sub-ritual',
    'Sub Refinement',
    'Sub-overhead',
    'Sub Test Execution',
  ];

  getRuntimeConfig(): ReportRuntimeConfig {
    const rawDomain = this.requireEnv('JIRA_DOMAIN');
    const jiraDomain = this.normalizeJiraDomain(rawDomain);
    const teamName = TeamName.from(this.requireEnv('TEAM_NAME'));
    const jiraCheckUrl = this.resolveJiraCheckUrl(jiraDomain, teamName);
    const jiraQuery = this.buildJiraQuery(teamName);
    const reportTitle = this.buildReportTitle(teamName);
    const timezone = this.resolveTimeZone();
    const requestedReportDate = (process.env.REPORT_DATE || '').trim();
    const reportDate = requestedReportDate
      ? ReportDate.from(requestedReportDate)
      : ReportDate.fromDate(new Date(), timezone);

    return {
      timezone: timezone.value,
      reportDate: reportDate.value,
      reportDateTimeLabel: this.formatDisplayDateTimeInTimeZone(new Date(), timezone.value),
      reportTitle,
      jiraQuery,
      aggregationDebug: this.getAggregationDebugConfig(),
      jiraCheckUrl,
      jira: {
        jiraDomain,
        jiraEmail: this.requireEnv('JIRA_EMAIL'),
        jiraApiToken: this.requireEnv('JIRA_API_TOKEN'),
        requestConfig: {
          auth: {
            username: this.requireEnv('JIRA_EMAIL'),
            password: this.requireEnv('JIRA_API_TOKEN'),
          },
          headers: {
            Accept: 'application/json',
          },
        },
      },
      chat: this.getChatDeliveryConfig(),
    };
  }

  canTriggerWithToken(token: string): boolean {
    const requiredToken = (process.env.CRON_SECRET || '').trim();

    if (!requiredToken) {
      return true;
    }

    return token === requiredToken;
  }

  isRetryAction(invokedFunction: string): boolean {
    return invokedFunction === 'retry_report';
  }

  private getChatDeliveryConfig(): ChatDeliveryConfig {
    const mode = this.resolveChatMode();

    if (mode === ChatMode.APP) {
      return {
        mode: ChatMode.APP,
        space: this.requireEnv('GOOGLE_CHAT_SPACE'),
        serviceAccountEmail: this.requireEnv('GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL'),
        serviceAccountPrivateKey: this.requireEnv('GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY').replaceAll(
          String.raw`\n`,
          '\n',
        ),
      };
    }

    const reportUrl = this.buildRetryReportUrl();

    return {
      mode: ChatMode.WEBHOOK,
      webhook: this.requireEnv('WEBHOOK'),
      ...(reportUrl ? { reportUrl } : {}),
    };
  }

  private resolveChatMode(): ChatMode {
    const rawMode = (process.env.GOOGLE_CHAT_MODE || '').trim().toLowerCase();

    if (rawMode === ChatMode.APP) {
      return ChatMode.APP;
    }

    if (rawMode === '' || rawMode === ChatMode.WEBHOOK) {
      return ChatMode.WEBHOOK;
    }

    this.logger.warn(
      `Invalid GOOGLE_CHAT_MODE value "${rawMode}". Falling back to ${ChatMode.WEBHOOK}.`,
    );
    return ChatMode.WEBHOOK;
  }

  private resolveTimeZone(): Timezone {
    const fallbackTimeZone = 'Asia/Ho_Chi_Minh';
    const rawReportTimeZone = (process.env.REPORT_TIMEZONE || '').trim();
    const normalizedReportTimeZone = rawReportTimeZone.replaceAll(/^:+/g, '');

    if (normalizedReportTimeZone) {
      try {
        return Timezone.from(normalizedReportTimeZone);
      } catch {
        this.logger.warn(
          `Invalid REPORT_TIMEZONE value "${rawReportTimeZone}". Falling back to ${fallbackTimeZone}.`,
        );
        return Timezone.from(fallbackTimeZone);
      }
    }

    const rawTimeZone = (process.env.TZ || '').trim();
    const normalizedTimeZone = rawTimeZone.replaceAll(/^:+/g, '');

    if (!normalizedTimeZone) {
      return Timezone.from(fallbackTimeZone);
    }

    if (['UTC', 'Etc/UTC', 'Etc/GMT'].includes(normalizedTimeZone)) {
      return Timezone.from(fallbackTimeZone);
    }

    try {
      return Timezone.from(normalizedTimeZone);
    } catch {
      this.logger.warn(`Invalid TZ value "${rawTimeZone}". Falling back to ${fallbackTimeZone}.`);
      return Timezone.from(fallbackTimeZone);
    }
  }

  private requireEnv(name: string): string {
    const value = (process.env[name] || '').trim();
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  private normalizeJiraDomain(rawDomain: string): string {
    const withScheme = /^https?:\/\//i.test(rawDomain) ? rawDomain : `https://${rawDomain}`;

    let normalized: URL;
    try {
      normalized = new URL(withScheme);
    } catch {
      throw new Error(`Invalid JIRA_DOMAIN: ${rawDomain}`);
    }

    if (!normalized.hostname) {
      throw new Error(`Invalid JIRA_DOMAIN hostname: ${rawDomain}`);
    }

    return normalized.origin;
  }

  private resolveJiraCheckUrl(jiraDomain: string, teamName: TeamName): string {
    const jiraCheckUrl = new URL(`/projects/${encodeURIComponent(teamName.value)}`, jiraDomain);
    jiraCheckUrl.searchParams.set('selectedItem', ReportConfigService.JIRA_REPORT_SELECTED_ITEM);
    return jiraCheckUrl.toString();
  }

  private buildReportTitle(teamName: TeamName): string {
    return teamName.toReportTitle();
  }

  private buildJiraQuery(teamName: TeamName): string {
    const issueTypes = ReportConfigService.JIRA_WORK_LOG_ISSUE_TYPES.map((issueType) => {
      if (issueType.includes(' ')) {
        return `"${issueType}"`;
      }
      return issueType;
    }).join(', ');

    return `project = ${teamName.value} AND type IN (${issueTypes}) AND worklogDate >= startOfDay(-2d)`;
  }

  private getAggregationDebugConfig(): AggregationDebugConfig {
    const enabled = this.isTruthyValue((process.env.REPORT_DEBUG || '').trim());
    const rawFilters = (process.env.REPORT_DEBUG_AUTHORS || '').trim();
    const authorFilters = rawFilters
      ? rawFilters
          .split(',')
          .map((item) => this.normalizeAuthorName(item).toLowerCase())
          .filter(Boolean)
      : [];

    return {
      enabled,
      authorFilters,
    };
  }

  private normalizeAuthorName(rawName: string): string {
    const name = rawName.trim();
    const shortName = name.split('(')[0]?.trim();
    return shortName || name;
  }

  private isTruthyValue(value: string): boolean {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private formatDisplayDateTimeInTimeZone(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'shortOffset',
    });

    const parts = formatter.formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const day = parts.find((part) => part.type === 'day')?.value || '';
    const year = parts.find((part) => part.type === 'year')?.value || '';
    const hour = parts.find((part) => part.type === 'hour')?.value || '';
    const minute = parts.find((part) => part.type === 'minute')?.value || '';
    const second = parts.find((part) => part.type === 'second')?.value || '';
    const dayPeriod = parts.find((part) => part.type === 'dayPeriod')?.value || '';
    const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value || '';

    return `${month} ${day}, ${year}, ${hour}:${minute}:${second} ${dayPeriod} (${timeZoneName})`;
  }

  private buildRetryReportUrl(): string | null {
    const appBaseUrl = this.resolveAppBaseUrl();
    let baseUrl: URL;
    try {
      baseUrl = new URL(appBaseUrl);
    } catch {
      this.logger.warn('APP_BASE_URL is invalid. Retry button will be skipped.');
      return null;
    }

    const configuredApiBasePath = (process.env.API_BASE_PATH || '').trim();
    const defaultApiBasePath = process.env.VERCEL ? '/api' : '';
    const rawApiBasePath = configuredApiBasePath || defaultApiBasePath;
    const trimmedApiBasePath = rawApiBasePath.replaceAll(/^\/+|\/+$/g, '');
    const normalizedApiBasePath = rawApiBasePath ? `/${trimmedApiBasePath}` : '';

    const retryUrl = new URL(`${normalizedApiBasePath}/reports/retry`, baseUrl);
    const cronSecret = (process.env.CRON_SECRET || '').trim();

    if (cronSecret) {
      retryUrl.searchParams.set('token', cronSecret);
    } else {
      this.logger.warn('CRON_SECRET is empty. Retry button will trigger a public endpoint.');
    }

    return retryUrl.toString();
  }

  private resolveAppBaseUrl(): string {
    const configuredAppBaseUrl = (process.env.APP_BASE_URL || '').trim();
    if (configuredAppBaseUrl) {
      return configuredAppBaseUrl;
    }

    const vercelUrl = (process.env.VERCEL_URL || '').trim();
    if (vercelUrl) {
      return `https://${vercelUrl}`;
    }

    const port = (process.env.PORT || '').trim() || '3000';
    return `http://localhost:${port}`;
  }
}
