import { Injectable, Logger } from '@nestjs/common';
import { ChatMode, type ChatDeliveryConfig, type ReportRuntimeConfig } from '../domain/report.types';

@Injectable()
export class ReportConfigService {
  private readonly logger = new Logger(ReportConfigService.name);
  private static readonly JIRA_REPORT_SELECTED_ITEM =
    'com.atlassian.plugins.atlassian-connect-plugin:com.gebsun.atlassian.reports.free__report';

  getRuntimeConfig(): ReportRuntimeConfig {
    const rawDomain = this.requireEnv('JIRA_DOMAIN');
    const jiraDomain = this.normalizeJiraDomain(rawDomain);
    const teamName = this.requireEnv('TEAM_NAME');
    const jiraCheckUrl = this.resolveJiraCheckUrl(jiraDomain, teamName);
    const timezone = this.resolveTimeZone();
    const requestedReportDate = (process.env.REPORT_DATE || '').trim();
    const reportDate = requestedReportDate || this.formatDateInTimeZone(new Date(), timezone);

    this.validateReportDate(reportDate);

    return {
      timezone,
      reportDate,
      reportDateTimeLabel: this.formatDisplayDateTimeInTimeZone(new Date(), timezone),
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

  private resolveTimeZone(): string {
    const fallbackTimeZone = 'Asia/Ho_Chi_Minh';
    const rawReportTimeZone = (process.env.REPORT_TIMEZONE || '').trim();
    const normalizedReportTimeZone = rawReportTimeZone.replaceAll(/^:+/g, '');

    if (normalizedReportTimeZone) {
      if (this.isValidTimeZone(normalizedReportTimeZone)) {
        return normalizedReportTimeZone;
      }

      this.logger.warn(
        `Invalid REPORT_TIMEZONE value "${rawReportTimeZone}". Falling back to ${fallbackTimeZone}.`,
      );
      return fallbackTimeZone;
    }

    const rawTimeZone = (process.env.TZ || '').trim();
    const normalizedTimeZone = rawTimeZone.replaceAll(/^:+/g, '');

    if (!normalizedTimeZone) {
      return fallbackTimeZone;
    }

    if (['UTC', 'Etc/UTC', 'Etc/GMT'].includes(normalizedTimeZone)) {
      return fallbackTimeZone;
    }

    if (this.isValidTimeZone(normalizedTimeZone)) {
      return normalizedTimeZone;
    }

    this.logger.warn(`Invalid TZ value "${rawTimeZone}". Falling back to ${fallbackTimeZone}.`);

    return fallbackTimeZone;
  }

  private isValidTimeZone(timeZone: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return true;
    } catch {
      return false;
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

  private resolveJiraCheckUrl(jiraDomain: string, teamName: string): string {
    const jiraCheckUrl = new URL(`/projects/${encodeURIComponent(teamName)}`, jiraDomain);
    jiraCheckUrl.searchParams.set('selectedItem', ReportConfigService.JIRA_REPORT_SELECTED_ITEM);
    return jiraCheckUrl.toString();
  }

  private validateReportDate(reportDate: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      throw new Error(`Invalid REPORT_DATE format: ${reportDate}. Expected YYYY-MM-DD`);
    }
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
