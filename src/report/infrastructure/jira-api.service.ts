import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { JiraGatewayPort } from '../domain/report.ports';
import type { Issue, JiraConfig, SearchResponse, WorklogItem, WorklogResponse } from '../domain/report.types';

const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_ISSUE_WORKLOG_PATH = '/rest/api/3/issue';
const SEARCH_FIELDS = ['worklog'];
const SEARCH_EXPAND = 'worklog';
const PAGE_SIZE = 100;
const WORKLOG_PAGE_SIZE = 100;
const DEFAULT_WORKLOG_CONCURRENCY = 8;
const MAX_WORKLOG_CONCURRENCY = 20;

@Injectable()
export class JiraApiService implements JiraGatewayPort {
  private readonly logger = new Logger(JiraApiService.name);

  async fetchIssuesWithWorkLogs(
    jira: JiraConfig,
    jql: string,
    debugEnabled: boolean,
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    let nextPageToken: string | undefined;
    let page = 0;

    do {
      page += 1;
      const payload: Record<string, unknown> = {
        jql,
        maxResults: PAGE_SIZE,
        fields: SEARCH_FIELDS,
        expand: SEARCH_EXPAND,
      };

      if (nextPageToken) {
        payload.nextPageToken = nextPageToken;
      }

      const response = await axios.post<SearchResponse & { nextPageToken?: string }>(
        `${jira.jiraDomain}${JIRA_SEARCH_PATH}`,
        payload,
        {
          auth: {
            username: jira.jiraEmail,
            password: jira.jiraApiToken,
          },
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      if (debugEnabled) {
        this.logJiraResponseDebug(page, response.data);
      }

      issues.push(...(response.data?.issues || []));
      nextPageToken = response.data?.nextPageToken;
    } while (nextPageToken);

    return this.hydrateIssuesWithFullWorkLogs(jira, issues, debugEnabled);
  }

  private async hydrateIssuesWithFullWorkLogs(
    jira: JiraConfig,
    issues: Issue[],
    debugEnabled: boolean,
  ): Promise<Issue[]> {
    const hydratedIssues: Issue[] = [];
    const worklogConcurrency = this.resolveWorklogConcurrency();

    for (let index = 0; index < issues.length; index += worklogConcurrency) {
      const chunk = issues.slice(index, index + worklogConcurrency);
      const hydratedChunk = await Promise.all(
        chunk.map((issue) => this.hydrateSingleIssueWithFullWorkLogs(jira, issue, debugEnabled)),
      );
      hydratedIssues.push(...hydratedChunk);
    }

    return hydratedIssues;
  }

  private async hydrateSingleIssueWithFullWorkLogs(
    jira: JiraConfig,
    issue: Issue,
    debugEnabled: boolean,
  ): Promise<Issue> {
    const issueKey = String(issue?.key || '');
    if (!issueKey) {
      return issue;
    }

    const fullWorkLogs = await this.fetchAllWorkLogsForIssue(jira, issueKey, debugEnabled);
    const existingWorklogField = issue?.fields?.worklog || {};

    return {
      ...issue,
      fields: issue.fields
        ? {
            ...issue.fields,
            worklog: {
              ...existingWorklogField,
              startAt: 0,
              maxResults: fullWorkLogs.length,
              total: fullWorkLogs.length,
              worklogs: fullWorkLogs,
            },
          }
        : {
            worklog: {
              ...existingWorklogField,
              startAt: 0,
              maxResults: fullWorkLogs.length,
              total: fullWorkLogs.length,
              worklogs: fullWorkLogs,
            },
          },
    };
  }

  private resolveWorklogConcurrency(): number {
    const rawValue = (process.env.REPORT_WORKLOG_CONCURRENCY || '').trim();
    if (!rawValue) {
      return DEFAULT_WORKLOG_CONCURRENCY;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      this.logger.warn(
        `Invalid REPORT_WORKLOG_CONCURRENCY value "${rawValue}". Falling back to ${DEFAULT_WORKLOG_CONCURRENCY}.`,
      );
      return DEFAULT_WORKLOG_CONCURRENCY;
    }

    return Math.min(parsedValue, MAX_WORKLOG_CONCURRENCY);
  }

  private async fetchAllWorkLogsForIssue(
    jira: JiraConfig,
    issueKey: string,
    debugEnabled: boolean,
  ): Promise<WorklogItem[]> {
    const worklogs: WorklogItem[] = [];
    let startAt = 0;
    let total = Number.POSITIVE_INFINITY;

    while (worklogs.length < total) {
      const response = await axios.get<WorklogResponse>(
        `${jira.jiraDomain}${JIRA_ISSUE_WORKLOG_PATH}/${encodeURIComponent(issueKey)}/worklog`,
        {
          auth: {
            username: jira.jiraEmail,
            password: jira.jiraApiToken,
          },
          headers: {
            Accept: 'application/json',
          },
          params: {
            startAt,
            maxResults: WORKLOG_PAGE_SIZE,
          },
        },
      );

      const pageWorkLogs = response.data?.worklogs || [];
      const pageTotal = Number(response.data?.total || 0);
      const currentStartAt = Number(response.data?.startAt || startAt);

      total = pageTotal;
      worklogs.push(...pageWorkLogs);

      if (debugEnabled) {
        this.logger.log(
          `Issue work logs page issue=${issueKey}, startAt=${currentStartAt}, fetched=${pageWorkLogs.length}, fetchedTotal=${worklogs.length}, total=${total}`,
        );
      }

      if (pageWorkLogs.length === 0) {
        break;
      }

      startAt = currentStartAt + pageWorkLogs.length;
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

    this.logger.log(`Jira raw response page=${page}, length=${serialized.length}, payload=${output}`);
  }
}
