import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const JQL = 'project = BKM4 AND worklogDate >= startOfDay(-2d)';
const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const SEARCH_FIELDS = ['worklog'];
const SEARCH_EXPAND = 'worklog';
const PAGE_SIZE = 100;
const JIRA_CHECK_BASE_URL =
    'https://oneline.atlassian.net/projects/BKM4?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.gebsun.atlassian.reports.free__report#!/?datem=useFromTo&period=days&projects=16890&timeZone=user&wlFormat=hours';

type JiraConfig = {
    domain: string;
    timezone: string;
    reportDate: string;
    reportTime: string;
    jiraCheckUrl: string;
    retryReportUrl: string | null;
    webhook: string;
    auth: {
        username: string;
        password: string;
    };
};

type AggregatedUser = {
    logs: Record<string, number>;
};

type AggregatedData = {
    users: Record<string, AggregatedUser>;
    reportDate: string;
};

@Injectable()
export class ReportService {
    private readonly logger = new Logger(ReportService.name);

    async runDailyReport(source: string) {
        const cfg = this.getConfig();
        const issues = await this.fetchIssues(cfg);
        const data = this.aggregateByReportDate(issues, cfg.reportDate, cfg.timezone);

        await this.sendToChat(
            cfg.webhook,
            {
                ...data,
                reportTime: cfg.reportTime,
            },
            cfg.jiraCheckUrl,
            cfg.retryReportUrl,
        );

        const userCount = Object.values(data.users).filter(
            (user) => (user.logs[cfg.reportDate] || 0) > 0,
        ).length;

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

    canTriggerWithToken(token: string): boolean {
        const requiredToken = (process.env.CRON_SECRET || '').trim();

        if (!requiredToken) {
            return true;
        }

        return token === requiredToken;
    }

    private getConfig(): JiraConfig {
        const rawDomain = this.requireEnv('JIRA_DOMAIN');
        const timezone = (process.env.TZ || 'Asia/Ho_Chi_Minh').trim();
        const requestedReportDate = (process.env.REPORT_DATE || '').trim();
        const reportDate =
            requestedReportDate || this.formatDateInTimeZone(new Date(), timezone);

        this.validateReportDate(reportDate);

        return {
            domain: this.normalizeJiraDomain(rawDomain),
            timezone,
            reportDate,
            reportTime: this.formatTimeInTimeZone(new Date(), timezone),
            jiraCheckUrl: this.buildJiraCheckUrl(this.shiftDateString(reportDate, -7), reportDate),
            retryReportUrl: this.buildRetryReportUrl(),
            webhook: this.requireEnv('WEBHOOK'),
            auth: {
                username: this.requireEnv('JIRA_EMAIL'),
                password: this.requireEnv('JIRA_API_TOKEN'),
            },
        };
    }

    private requireEnv(name: string): string {
        const value = (process.env[name] || '').trim();
        if (!value) {
            throw new Error(`Missing required environment variable: ${name}`);
        }
        return value;
    }

    private normalizeJiraDomain(rawDomain: string): string {
        const withScheme = /^https?:\/\//i.test(rawDomain)
            ? rawDomain
            : `https://${rawDomain}`;

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

    private validateReportDate(reportDate: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            throw new Error(
                `Invalid REPORT_DATE format: ${reportDate}. Expected YYYY-MM-DD`,
            );
        }
    }

    private shiftDateString(dateString: string, dayOffset: number): string {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + dayOffset);
        return date.toISOString().slice(0, 10);
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

    private buildJiraCheckUrl(reportFromDate: string, reportToDate: string): string {
        const [base, hash = ''] = JIRA_CHECK_BASE_URL.split('#');
        const hashPathAndQuery = hash.startsWith('!/') ? hash.slice(2) : hash;
        const [hashPath, hashQuery = ''] = hashPathAndQuery.split('?');

        const url = new URL(base);
        const hashParams = new URLSearchParams(hashQuery);
        hashParams.set('from', reportFromDate);
        hashParams.set('to', reportToDate);

        const serializedHash = `${hashPath}?${hashParams.toString()}`;
        url.hash = `!/${serializedHash}`;
        return url.toString();
    }

    private buildRetryReportUrl(): string | null {
        const appBaseUrl = (process.env.APP_BASE_URL || '').trim();
        if (!appBaseUrl) {
            this.logger.warn('APP_BASE_URL is empty. Retry button will be skipped.');
            return null;
        }

        let baseUrl: URL;
        try {
            baseUrl = new URL(appBaseUrl);
        } catch {
            this.logger.warn('APP_BASE_URL is invalid. Retry button will be skipped.');
            return null;
        }

        const retryUrl = new URL('/reports/retry', baseUrl);
        const cronSecret = (process.env.CRON_SECRET || '').trim();

        if (cronSecret) {
            retryUrl.searchParams.set('token', cronSecret);
        } else {
            this.logger.warn('CRON_SECRET is empty. Retry button will trigger a public endpoint.');
        }

        return retryUrl.toString();
    }

    private async fetchIssues(cfg: JiraConfig): Promise<any[]> {
        const issues: any[] = [];
        let nextPageToken: string | undefined;

        do {
            const payload: Record<string, unknown> = {
                jql: JQL,
                maxResults: PAGE_SIZE,
                fields: SEARCH_FIELDS,
                expand: SEARCH_EXPAND,
            };

            if (nextPageToken) {
                payload.nextPageToken = nextPageToken;
            }

            const response = await axios.post(`${cfg.domain}${JIRA_SEARCH_PATH}`, payload, {
                auth: cfg.auth,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            issues.push(...(response.data?.issues || []));
            nextPageToken = response.data?.nextPageToken;
        } while (nextPageToken);

        return issues;
    }

    private aggregateByReportDate(
        issues: any[],
        reportDate: string,
        timezone: string,
    ): AggregatedData {
        const users: Record<string, AggregatedUser> = {};

        for (const issue of issues) {
            const logs = issue?.fields?.worklog?.worklogs || [];

            for (const worklog of logs) {
                const date = this.formatDateInTimeZone(new Date(worklog.started), timezone);
                if (date !== reportDate) {
                    continue;
                }

                const name = worklog?.author?.displayName || 'Unknown';
                const seconds = worklog.timeSpentSeconds || 0;

                if (!users[name]) {
                    users[name] = { logs: {} };
                }

                users[name].logs[date] = (users[name].logs[date] || 0) + seconds;
            }
        }

        return { users, reportDate };
    }

    private buildChatTextReport(data: {
        users: Record<string, AggregatedUser>;
        reportDate: string;
        reportTime: string;
    }): string {
        const rows = Object.entries(data.users)
            .map(([name, user]) => {
                const totalSeconds = user.logs[data.reportDate] || 0;
                return { name, totalSeconds };
            })
            .filter((row) => row.totalSeconds > 0)
            .sort((left, right) => right.totalSeconds - left.totalSeconds);

        if (rows.length === 0) {
            return `BKM4 Report\nDate: ${data.reportDate} ${data.reportTime} (VN Time)\nNo worklog data for today.`;
        }

        const grandTotalSeconds = rows.reduce(
            (sumSeconds, row) => sumSeconds + row.totalSeconds,
            0,
        );
        const cappedRows = rows.slice(0, 50);
        const nameWidth = Math.max(
            'Work Log Author'.length,
            ...cappedRows.map((row) => row.name.length),
            'Total'.length,
        );
        const totalWidth = Math.max(
            'Total'.length,
            ...cappedRows.map((row) => this.formatHoursFromSeconds(row.totalSeconds).length),
            this.formatHoursFromSeconds(grandTotalSeconds).length,
        );

        const separator = `${'-'.repeat(nameWidth)}|${'-'.repeat(totalWidth)}`;
        const header = `${'Work Log Author'.padEnd(nameWidth)}|${'Total'.padStart(totalWidth)}`;
        const rowLines = cappedRows.map((row) => {
            const hoursText = this.formatHoursFromSeconds(row.totalSeconds);
            return `${row.name.padEnd(nameWidth)}|${hoursText.padStart(totalWidth)}`;
        });
        const totalHoursText = this.formatHoursFromSeconds(grandTotalSeconds);
        const totalLine = `${'Total'.padEnd(nameWidth)}|${totalHoursText.padStart(totalWidth)}`;

        return [
            'BKM4 Worklog Report',
            `Date: ${data.reportDate} ${data.reportTime} (VN Time)`,
            '```',
            header,
            separator,
            ...rowLines,
            separator,
            totalLine,
            '```',
        ].join('\n');
    }

    private async sendToChat(
        webhook: string,
        data: {
            users: Record<string, AggregatedUser>;
            reportDate: string;
            reportTime: string;
        },
        jiraCheckUrl: string,
        retryReportUrl: string | null,
    ): Promise<void> {
        const text = this.buildChatTextReport(data);
        await axios.post(webhook, { text });

        try {
            const buttons = [
                ...(retryReportUrl
                    ? [
                        {
                            text: 'Kiểm tra lại',
                            onClick: {
                                openLink: {
                                    url: retryReportUrl,
                                },
                            },
                        },
                    ]
                    : []),
                {
                    text: 'Kiểm tra trên Jira',
                    onClick: {
                        openLink: {
                            url: jiraCheckUrl,
                        },
                    },
                },
            ];

            await axios.post(webhook, {
                cardsV2: [
                    {
                        cardId: 'jira-check',
                        card: {
                            sections: [
                                {
                                    widgets: [
                                        {
                                            buttonList: {
                                                buttons,
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            });
        } catch (error) {
            this.logger.warn(
                `Failed to send Jira button card, text report already sent: ${(error as Error).message}`,
            );
        }
    }
}
