import { Injectable } from '@nestjs/common';
import type { AggregatedData, AggregatedUser, Issue } from './report.types';
import { ReportDate, Timezone } from './value-objects';

@Injectable()
export class ReportAggregationService {
  aggregateByReportDate(issues: Issue[], reportDate: ReportDate, timezone: Timezone): AggregatedData {
    const users: Record<string, AggregatedUser> = {};

    for (const issue of issues) {
      const logs = issue?.fields?.worklog?.worklogs || [];

      for (const worklog of logs) {
        const startedDate = new Date(String(worklog?.started || ''));
        const startedLocalDate = timezone.formatDate(startedDate);

        if (!reportDate.equals(startedLocalDate)) {
          continue;
        }

        const name = this.normalizeAuthorName(worklog?.author?.displayName || 'Unknown');
        const seconds = worklog?.timeSpentSeconds || 0;

        if (!users[name]) {
          users[name] = { logs: {} };
        }

        users[name].logs[startedLocalDate] = (users[name].logs[startedLocalDate] || 0) + seconds;
      }
    }

    return { users, reportDate: reportDate.value };
  }

  private normalizeAuthorName(rawName: string): string {
    const name = rawName.trim();
    const shortName = name.split('(')[0]?.trim();
    return shortName || name;
  }

}
