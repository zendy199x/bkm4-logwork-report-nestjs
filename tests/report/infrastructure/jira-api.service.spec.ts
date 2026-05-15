import axios from 'axios';
import { JiraApiService } from '../../../src/report/infrastructure/jira-api.service';

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

describe('JiraApiService', () => {
  const mockedAxios = jest.mocked(axios, { shallow: false });

  const jira = {
    jiraDomain: 'https://oneline.atlassian.net',
    jiraEmail: 'bot@example.com',
    jiraApiToken: 'token',
    requestConfig: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REPORT_WORKLOG_CONCURRENCY;
  });

  it('fetches issues and hydrates work logs', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { issues: [{ key: 'BKM4-1', fields: { worklog: { worklogs: [] } } }] },
    });
    mockedAxios.get.mockResolvedValue({
      data: { worklogs: [{ id: '1', timeSpentSeconds: 60 }], total: 1, startAt: 0 },
    });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues).toHaveLength(1);
    expect(issues[0].fields.worklog.total).toBe(1);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('handles paged search and debug logs', async () => {
    const circular = { issues: [], nextPageToken: 'n1', self: null as unknown };
    circular.self = circular;

    mockedAxios.post
      .mockResolvedValueOnce({ data: circular })
      .mockResolvedValueOnce({ data: { issues: [], nextPageToken: undefined } });

    const service = new JiraApiService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);

    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', true);

    expect(issues).toEqual([]);
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalled();
  });

  it('sets next page token in payload for subsequent pages', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { issues: [], nextPageToken: 'p2' } })
      .mockResolvedValueOnce({ data: { issues: [], nextPageToken: 'p3' } })
      .mockResolvedValueOnce({ data: { issues: [], nextPageToken: undefined } });

    const service = new JiraApiService();
    await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    const secondPayload = mockedAxios.post.mock.calls[1][1] as { nextPageToken?: string };
    const thirdPayload = mockedAxios.post.mock.calls[2][1] as { nextPageToken?: string };
    expect(secondPayload.nextPageToken).toBe('p2');
    expect(thirdPayload.nextPageToken).toBe('p3');
  });

  it('handles undefined issues list from search response', async () => {
    mockedAxios.post.mockResolvedValue({ data: undefined });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues).toEqual([]);
  });

  it('breaks work log paging when page returns no rows', async () => {
    mockedAxios.post.mockResolvedValue({ data: { issues: [{ key: 'BKM4-2', fields: {} }] } });
    mockedAxios.get.mockResolvedValue({ data: { worklogs: [], total: 5, startAt: 0 } });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', true);

    expect(issues[0].fields.worklog.total).toBe(0);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('keeps issue as is when key is missing', async () => {
    mockedAxios.post.mockResolvedValue({ data: { issues: [{ key: '', fields: {} }] } });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues).toHaveLength(1);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('hydrates issue when fields are missing', async () => {
    mockedAxios.post.mockResolvedValue({ data: { issues: [{ key: 'BKM4-3' }] } });
    mockedAxios.get.mockResolvedValue({
      data: { worklogs: [{ id: '1', timeSpentSeconds: 120 }], total: 1, startAt: 0 },
    });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues[0].fields.worklog.total).toBe(1);
  });

  it('collects multiple worklog pages', async () => {
    mockedAxios.post.mockResolvedValue({ data: { issues: [{ key: 'BKM4-4', fields: { worklog: {} } }] } });
    mockedAxios.get
      .mockResolvedValueOnce({ data: { worklogs: [{ id: '1' }], total: 2, startAt: 0 } })
      .mockResolvedValueOnce({ data: { worklogs: [{ id: '2' }], total: 2, startAt: 1 } });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', true);

    expect(issues[0].fields.worklog.total).toBe(2);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('handles undefined worklog payload safely', async () => {
    mockedAxios.post.mockResolvedValue({ data: { issues: [{ key: 'BKM4-5', fields: { worklog: {} } }] } });
    mockedAxios.get.mockResolvedValue({ data: undefined });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues[0].fields.worklog.total).toBe(0);
  });

  it('handles unserializable debug payload', async () => {
    const service = new JiraApiService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    const payload = { self: null as unknown };
    payload.self = payload;

    service['logJiraResponseDebug'](1, payload);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[unserializable-jira-response]'));
  });

  it('truncates huge debug payload output', () => {
    const service = new JiraApiService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    const hugePayload = { value: 'x'.repeat(22000) };

    service['logJiraResponseDebug'](2, hugePayload);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[truncated]'));
  });

  it('hydrates issue worklogs with bounded concurrency', async () => {
    process.env.REPORT_WORKLOG_CONCURRENCY = '2';

    mockedAxios.post.mockResolvedValue({
      data: {
        issues: [
          { key: 'BKM4-1', fields: { worklog: {} } },
          { key: 'BKM4-2', fields: { worklog: {} } },
          { key: 'BKM4-3', fields: { worklog: {} } },
          { key: 'BKM4-4', fields: { worklog: {} } },
        ],
      },
    });

    let inFlight = 0;
    let maxInFlight = 0;

    mockedAxios.get.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      await new Promise((resolve) => setTimeout(resolve, 5));

      inFlight -= 1;

      return {
        data: { worklogs: [{ id: '1', timeSpentSeconds: 60 }], total: 1, startAt: 0 },
      };
    });

    const service = new JiraApiService();
    const issues = await service.fetchIssuesWithWorkLogs(jira, 'project = BKM4', false);

    expect(issues).toHaveLength(4);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
