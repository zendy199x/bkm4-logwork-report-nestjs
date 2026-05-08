import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Issue, JiraConfig, SearchResponse, WorklogItem, WorklogResponse } from '../domain/report.types';

const JQL = 'project = BKM4 AND worklogDate >= startOfDay(-2d)';
const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_ISSUE_WORKLOG_PATH = '/rest/api/3/issue';
const SEARCH_FIELDS = ['worklog'];
const SEARCH_EXPAND = 'worklog';
const PAGE_SIZE = 100;
const WORKLOG_PAGE_SIZE = 100;

@Injectable()
export class JiraApiService {
  private readonly logger = new Logger(JiraApiService.name);

  async fetchIssuesWithWorklogs(jira: JiraConfig, debugEnabled: boolean): Promise<Issue[]> {
    const issues: Issue[] = [];
    let nextPageToken: string | undefined;
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

    return this.hydrateIssuesWithFullWorklogs(jira, issues, debugEnabled);
  }

  private async hydrateIssuesWithFullWorklogs(
    jira: JiraConfig,
    issues: Issue[],
    debugEnabled: boolean,
  ): Promise<Issue[]> {
    const hydratedIssues: Issue[] = [];

    for (const issue of issues) {
      const issueKey = String(issue?.key || '');
      if (!issueKey) {
        hydratedIssues.push(issue);
        continue;
      }

      const fullWorklogs = await this.fetchAllWorklogsForIssue(jira, issueKey, debugEnabled);
      const existingWorklogField = issue?.fields?.worklog || {};

      hydratedIssues.push({
        ...issue,
        fields: issue.fields
          ? {
              ...issue.fields,
              worklog: {
                ...existingWorklogField,
                startAt: 0,
                maxResults: fullWorklogs.length,
                total: fullWorklogs.length,
                worklogs: fullWorklogs,
              },
            }
          : {
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

    this.logger.log(`Jira raw response page=${page}, length=${serialized.length}, payload=${output}`);
  }
}
