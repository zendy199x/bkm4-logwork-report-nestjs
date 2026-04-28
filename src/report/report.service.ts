import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { JWT } from 'google-auth-library';

const JQL = 'project = BKM4 AND worklogDate >= startOfDay(-2d)';
const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_ISSUE_WORKLOG_PATH = '/rest/api/3/issue';
const SEARCH_FIELDS = ['worklog'];
const SEARCH_EXPAND = 'worklog';
const PAGE_SIZE = 100;
const WORKLOG_PAGE_SIZE = 100;
const JIRA_CHECK_URL =
    'https://oneline.atlassian.net/projects/BKM4?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.gebsun.atlassian.reports.free__report';

type JiraConfig = {
    domain: string;
    timezone: string;
    reportDate: string;
    reportDateTimeLabel: string;
    jiraCheckUrl: string;
    chat: ChatDeliveryConfig;
    auth: {
        username: string;
        password: string;
    };
};

type ChatDeliveryConfig =
    | {
        mode: 'webhook';
        webhookUrl: string;
        retryReportUrl: string | null;
    }
    | {
        mode: 'app';
        space: string;
        serviceAccountEmail: string;
        serviceAccountPrivateKey: string;
    };

type GoogleChatEvent = {
    type?: string;
    action?: {
        actionMethodName?: string;
    };
    common?: {
        invokedFunction?: string;
    };
    commonEventObject?: {
        invokedFunction?: string;
    };
    space?: {
        name?: string;
    };
};

type AggregatedUser = {
    logs: Record<string, number>;
};

type AggregatedData = {
    users: Record<string, AggregatedUser>;
    reportDate: string;
};

type DebugAggregationContext = {
    issueKey: string;
    worklogId: string;
    author: string;
    startedRaw: string;
    startedLocalDate: string;
    startedLocalTime: string;
    reportDate: string;
    seconds: number;
};

@Injectable()
export class ReportService {
    private readonly logger = new Logger(ReportService.name);

    async runDailyReport(source: string) {
        const cfg = this.getConfig();
        const issues = await this.fetchIssues(cfg);
        const data = this.aggregateByReportDate(issues, cfg.reportDate, cfg.timezone);

        await this.sendToChat(
            cfg.chat,
            {
                ...data,
                reportDateTimeLabel: cfg.reportDateTimeLabel,
            },
            cfg.jiraCheckUrl,
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
        const timezone = this.resolveTimeZone();
        const requestedReportDate = (process.env.REPORT_DATE || '').trim();
        const reportDate =
            requestedReportDate || this.formatDateInTimeZone(new Date(), timezone);

        this.validateReportDate(reportDate);

        return {
            domain: this.normalizeJiraDomain(rawDomain),
            timezone,
            reportDate,
            reportDateTimeLabel: this.formatDisplayDateTimeInTimeZone(new Date(), timezone),
            jiraCheckUrl: JIRA_CHECK_URL,
            chat: this.getChatDeliveryConfig(),
            auth: {
                username: this.requireEnv('JIRA_EMAIL'),
                password: this.requireEnv('JIRA_API_TOKEN'),
            },
        };
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

        this.logger.warn(
            `Invalid TZ value "${rawTimeZone}". Falling back to ${fallbackTimeZone}.`,
        );

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

    async handleGoogleChatEvent(event: unknown): Promise<Record<string, unknown>> {
        const chatEvent = (event || {}) as GoogleChatEvent;
        const eventType = (chatEvent.type || '').toUpperCase();

        if (eventType === 'CARD_CLICKED' && this.isRetryAction(chatEvent)) {
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

    private isRetryAction(event: GoogleChatEvent): boolean {
        const invokedFunction =
            event.common?.invokedFunction ||
            event.commonEventObject?.invokedFunction ||
            event.action?.actionMethodName ||
            '';

        return invokedFunction === 'retry_report';
    }

    private getChatDeliveryConfig(): ChatDeliveryConfig {
        const mode = (process.env.GOOGLE_CHAT_MODE || 'webhook').trim().toLowerCase();

        if (mode === 'app') {
            return {
                mode: 'app',
                space: this.requireEnv('GOOGLE_CHAT_SPACE'),
                serviceAccountEmail: this.requireEnv('GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL'),
                serviceAccountPrivateKey: this.requireEnv('GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY')
                    .replaceAll(String.raw`\n`, '\n'),
            };
        }

        return {
            mode: 'webhook',
            webhookUrl: this.requireEnv('WEBHOOK'),
            retryReportUrl: this.buildRetryReportUrl(),
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

    private formatHoursFromSeconds(totalSeconds: number): string {
        const hours = totalSeconds / 3600;
        return `${String(hours)}h`;
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

        const configuredApiBasePath = (process.env.API_BASE_PATH || '').trim();
        const defaultApiBasePath = process.env.VERCEL ? '/api' : '';
        const rawApiBasePath = configuredApiBasePath || defaultApiBasePath;
        const trimmedApiBasePath = rawApiBasePath.replaceAll(/^\/+|\/+$/g, '');
        const normalizedApiBasePath = rawApiBasePath
            ? `/${trimmedApiBasePath}`
            : '';

        const retryUrl = new URL(`${normalizedApiBasePath}/reports/retry`, baseUrl);
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
        const debugEnabled = this.isAggregationDebugEnabled();
        let page = 0;

        do {
            page += 1;
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

            if (debugEnabled) {
                this.logJiraResponseDebug(page, response.data);
            }

            issues.push(...(response.data?.issues || []));
            nextPageToken = response.data?.nextPageToken;
        } while (nextPageToken);

        return this.hydrateIssuesWithFullWorklogs(cfg, issues, debugEnabled);
    }

    private async hydrateIssuesWithFullWorklogs(
        cfg: JiraConfig,
        issues: any[],
        debugEnabled: boolean,
    ): Promise<any[]> {
        const hydratedIssues: any[] = [];

        for (const issue of issues) {
            const issueKey = String(issue?.key || '');
            if (!issueKey) {
                hydratedIssues.push(issue);
                continue;
            }

            const fullWorklogs = await this.fetchAllWorklogsForIssue(cfg, issueKey, debugEnabled);
            const issueFields = issue?.fields ?? {};
            const existingWorklogField = issue?.fields?.worklog || {};

            hydratedIssues.push({
                ...issue,
                fields: {
                    ...issueFields,
                    worklog: {
                        ...existingWorklogField,
                        startAt: 0,
                        maxResults: fullWorklogs.length,
                        total: fullWorklogs.length,
                        worklogs: fullWorklogs,
                    },
                },
            });
        }

        return hydratedIssues;
    }

    private async fetchAllWorklogsForIssue(
        cfg: JiraConfig,
        issueKey: string,
        debugEnabled: boolean,
    ): Promise<any[]> {
        const worklogs: any[] = [];
        let startAt = 0;
        let total = Number.POSITIVE_INFINITY;

        while (worklogs.length < total) {
            const response = await axios.get(
                `${cfg.domain}${JIRA_ISSUE_WORKLOG_PATH}/${encodeURIComponent(issueKey)}/worklog`,
                {
                    auth: cfg.auth,
                    headers: {
                        Accept: 'application/json',
                    },
                    params: {
                        startAt,
                        maxResults: WORKLOG_PAGE_SIZE,
                    },
                },
            );

            const pageWorklogs = response.data?.worklogs || [];
            const pageTotal = Number(response.data?.total || 0);
            const currentStartAt = Number(response.data?.startAt || startAt);

            total = pageTotal;
            worklogs.push(...pageWorklogs);

            if (debugEnabled) {
                this.logger.log(
                    `Issue worklogs page issue=${issueKey}, startAt=${currentStartAt}, fetched=${pageWorklogs.length}, fetchedTotal=${worklogs.length}, total=${total}`,
                );
            }

            if (pageWorklogs.length === 0) {
                break;
            }

            startAt = currentStartAt + pageWorklogs.length;
        }

        return worklogs;
    }

    private logJiraResponseDebug(page: number, jiraResponseData: unknown): void {
        const maxLength = 20000;
        let serialized = '';

        try {
            serialized = JSON.stringify(jiraResponseData);
        } catch {
            serialized = '[unserializable-jira-response]';
        }

        const isTruncated = serialized.length > maxLength;
        const output = isTruncated ? `${serialized.slice(0, maxLength)}...[truncated]` : serialized;

        this.logger.log(
            `Jira raw response page=${page}, length=${serialized.length}, payload=${output}`,
        );
    }

    private aggregateByReportDate(
        issues: any[],
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
        const context: DebugAggregationContext = {
            issueKey,
            worklogId: String(worklog?.id || 'UNKNOWN_WORKLOG'),
            author: name,
            startedRaw: String(worklog?.started || ''),
            startedLocalDate,
            startedLocalTime,
            reportDate,
            seconds,
        };

        this.logWorklogDebugIfEnabled(context, debugEnabled, debugAuthorFilters);

        if (startedLocalDate !== reportDate) {
            this.logSkippedWorklogIfNeeded(context, debugEnabled, debugAuthorFilters);
            return;
        }

        if (!users[name]) {
            users[name] = { logs: {} };
        }

        users[name].logs[startedLocalDate] = (users[name].logs[startedLocalDate] || 0) + seconds;
    }

    private logWorklogDebugIfEnabled(
        context: DebugAggregationContext,
        debugEnabled: boolean,
        debugAuthorFilters: string[],
    ): void {
        if (!debugEnabled) {
            return;
        }

        if (!this.shouldLogDebugForAuthor(debugAuthorFilters, context.author)) {
            return;
        }

        this.logger.log(this.buildWorklogDebugMessage(context));
    }

    private logSkippedWorklogIfNeeded(
        context: DebugAggregationContext,
        debugEnabled: boolean,
        debugAuthorFilters: string[],
    ): void {
        if (!debugEnabled) {
            return;
        }

        if (!this.shouldLogDebugForAuthor(debugAuthorFilters, context.author)) {
            return;
        }

        this.logger.log(
            `Skipped worklog issue=${context.issueKey}, id=${context.worklogId}, author=${context.author} because localDate=${context.startedLocalDate} != reportDate=${context.reportDate}`,
        );
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

    private buildWorklogDebugMessage(ctx: DebugAggregationContext): string {
        const hours = ctx.seconds / 3600;
        return `Worklog issue=${ctx.issueKey}, id=${ctx.worklogId}, author=${ctx.author}, startedRaw=${ctx.startedRaw}, localDate=${ctx.startedLocalDate}, localTime=${ctx.startedLocalTime}, reportDate=${ctx.reportDate}, seconds=${ctx.seconds}, hours=${hours}`;
    }

    private normalizeAuthorName(rawName: string): string {
        const name = rawName.trim();
        const shortName = name.split('(')[0]?.trim();
        return shortName || name;
    }

    private buildChatTextReport(data: {
        users: Record<string, AggregatedUser>;
        reportDate: string;
        reportDateTimeLabel: string;
    }): string {
        const rows = Object.entries(data.users)
            .map(([name, user]) => {
                const totalSeconds = user.logs[data.reportDate] || 0;
                return { name, totalSeconds };
            })
            .filter((row) => row.totalSeconds > 0)
            .sort((left, right) => right.totalSeconds - left.totalSeconds);

        if (rows.length === 0) {
            const noDataText = 'No worklog data at this time';
            const noDataBorder = `+${'-'.repeat(noDataText.length + 2)}+`;
            const noDataLine = `| ${noDataText} |`;

            return [
                '```',
                '--BKM4 LOGWORK REPORT--',
                `Date: ${data.reportDateTimeLabel}`,
                noDataBorder,
                noDataLine,
                noDataBorder,
                '```',
            ].join('\n');
        }

        const grandTotalSeconds = rows.reduce(
            (sumSeconds, row) => sumSeconds + row.totalSeconds,
            0,
        );
        const cappedRows = rows.slice(0, 50);
        const nameWidth = Math.max(
            'Author'.length,
            ...cappedRows.map((row, index) => `${index + 1}. ${row.name}`.length),
            'Total'.length,
        );
        const totalWidth = Math.max(
            'Total'.length,
            ...cappedRows.map((row) => this.formatHoursFromSeconds(row.totalSeconds).length),
            this.formatHoursFromSeconds(grandTotalSeconds).length,
        );

        const horizontalBorder = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(totalWidth + 2)}+`;
        const totalBorder = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(totalWidth + 2)}+`;
        const header = `| ${'Author'.padEnd(nameWidth)} | ${'Total'.padStart(totalWidth)} |`;
        const rowLines = cappedRows.map((row, index) => {
            const hoursText = this.formatHoursFromSeconds(row.totalSeconds);
            const authorText = `${index + 1}. ${row.name}`;
            return `| ${authorText.padEnd(nameWidth)} | ${hoursText.padStart(totalWidth)} |`;
        });
        const totalHoursText = this.formatHoursFromSeconds(grandTotalSeconds);
        const totalLine = `| ${'Total'.padEnd(nameWidth)} | ${totalHoursText.padStart(totalWidth)} |`;

        return [
            '```',
            '--BKM4 LOGWORK REPORT--',
            `Date: ${data.reportDateTimeLabel}`,
            horizontalBorder,
            header,
            horizontalBorder,
            ...rowLines,
            totalBorder,
            totalLine,
            totalBorder,
            '```',
        ].join('\n');
    }

    private async sendToChat(
        chat: ChatDeliveryConfig,
        data: {
            users: Record<string, AggregatedUser>;
            reportDate: string;
            reportDateTimeLabel: string;
        },
        jiraCheckUrl: string,
    ): Promise<void> {
        const text = this.buildChatTextReport(data);
        await this.postToChat(chat, { text });

        try {
            const buttons = [
                ...this.buildRetryButtons(chat),
                {
                    text: 'Kiểm tra trên Jira',
                    onClick: {
                        openLink: {
                            url: jiraCheckUrl,
                        },
                    },
                },
            ];

            await this.postToChat(chat, {
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

    private buildRetryButtons(chat: ChatDeliveryConfig): Array<Record<string, unknown>> {
        if (chat.mode === 'app') {
            return [
                {
                    text: 'Kiểm tra lại',
                    onClick: {
                        action: {
                            function: 'retry_report',
                        },
                    },
                },
            ];
        }

        if (chat.retryReportUrl) {
            return [
                {
                    text: 'Kiểm tra lại',
                    onClick: {
                        openLink: {
                            url: chat.retryReportUrl,
                        },
                    },
                },
            ];
        }

        return [];
    }

    private async postToChat(
        chat: ChatDeliveryConfig,
        payload: Record<string, unknown>,
    ): Promise<void> {
        if (chat.mode === 'webhook') {
            await axios.post(chat.webhookUrl, payload);
            return;
        }

        const accessToken = await this.getGoogleChatAccessToken(chat);
        const url = `https://chat.googleapis.com/v1/${chat.space}/messages`;

        await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
    }

    private async getGoogleChatAccessToken(chat: Extract<ChatDeliveryConfig, { mode: 'app' }>): Promise<string> {
        const client = new JWT({
            email: chat.serviceAccountEmail,
            key: chat.serviceAccountPrivateKey,
            scopes: ['https://www.googleapis.com/auth/chat.bot'],
        });

        const { access_token: accessToken } = await client.authorize();
        if (!accessToken) {
            throw new Error('Failed to obtain Google Chat access token');
        }

        return accessToken;
    }
}
