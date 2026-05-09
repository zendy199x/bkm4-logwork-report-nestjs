import { ReportAggregationService } from '../../../src/report/domain/report-aggregation.service';
import { ReportDate, Timezone } from '../../../src/report/domain/value-objects';

describe('ReportAggregationService', () => {
  const service = new ReportAggregationService();

  it('aggregates only work logs that match report date in timezone', () => {
    const issues = [
      {
        key: 'BKM4-1',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w1',
                author: { displayName: 'Alice (BKM4)' },
                timeSpentSeconds: 3600,
                started: '2026-05-08T18:00:00.000Z',
              },
              {
                id: 'w2',
                author: { displayName: 'Alice (BKM4)' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T20:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('Asia/Ho_Chi_Minh'),
    );

    expect(result.reportDate).toBe('2026-05-09');
    expect(result.users.Alice.logs['2026-05-09']).toBe(3600);
  });

  it('sums multiple work logs for the same normalized author', () => {
    const issues = [
      {
        key: 'BKM4-2',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w3',
                author: { displayName: 'Tyler (OneLine)' },
                timeSpentSeconds: 1200,
                started: '2026-05-09T02:00:00.000Z',
              },
              {
                id: 'w4',
                author: { displayName: 'Tyler' },
                timeSpentSeconds: 2400,
                started: '2026-05-09T06:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(Object.keys(result.users)).toEqual(['Tyler']);
    expect(result.users.Tyler.logs['2026-05-09']).toBe(3600);
  });

  it('uses Unknown author fallback and ignores issues without work logs', () => {
    const issues = [
      {
        key: 'BKM4-3',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w5',
                timeSpentSeconds: 900,
                started: '2026-05-09T00:30:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-4',
        fields: {},
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users.Unknown.logs['2026-05-09']).toBe(900);
    expect(Object.keys(result.users)).toHaveLength(1);
  });

  it('handles missing worklog list safely', () => {
    const issues = [
      {
        key: 'BKM4-5',
        fields: {},
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users).toEqual({});
    expect(result.reportDate).toBe('2026-05-09');
  });

  it('uses 0 seconds when timeSpentSeconds is missing', () => {
    const issues = [
      {
        key: 'BKM4-6',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w6',
                author: { displayName: '(NoName)' },
                started: '2026-05-09T00:30:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users['(NoName)'].logs['2026-05-09']).toBe(0);
  });

  it('throws when work log started date is invalid', () => {
    const issues = [
      {
        key: 'BKM4-7',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w7',
                author: { displayName: 'Alice' },
              },
            ],
          },
        },
      },
    ];

    expect(() =>
      service.aggregateByReportDate(issues, ReportDate.from('2026-05-09'), Timezone.from('UTC')),
    ).toThrow();
  });
});
