import { ReportRunnerService } from '../../../src/report/application/report-runner.service';

function hasLogMessage(logCalls: unknown[][], keyword: string): boolean {
  return logCalls.some((call) => {
    const firstArg = call[0];
    return typeof firstArg === 'string' && firstArg.includes(keyword);
  });
}

describe('ReportRunnerService', () => {
  let configService: any;
  let jiraGateway: any;
  let chatGateway: any;
  let lastReportCache: any;
  let aggregationService: any;
  let service: any;

  beforeEach(() => {
    configService = {
      getRuntimeConfig: jest.fn().mockReturnValue({
        timezone: 'UTC',
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9, 2026, 1:00:00 PM (+00:00)',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        jiraQuery: 'project = BKM4',
        aggregationDebug: { enabled: true, authorFilters: [] },
        jiraCheckUrl: 'https://jira.example.com/projects/BKM4',
        jira: { jiraDomain: 'https://jira.example.com', jiraEmail: 'a', jiraApiToken: 'b', requestConfig: {} },
        chat: { mode: 'webhook', webhook: 'https://chat.example.com' },
      }),
      canTriggerWithToken: jest.fn().mockReturnValue(true),
      isRetryAction: jest.fn((fn) => fn === 'retry_report'),
    };

    jiraGateway = { fetchIssuesWithWorkLogs: jest.fn().mockResolvedValue([]) };
    aggregationService = {
      aggregateByReportDate: jest.fn().mockReturnValue({ users: { Alice: { logs: { '2026-05-09': 3600 } } }, reportDate: '2026-05-09' }),
    };
    chatGateway = { sendReport: jest.fn().mockResolvedValue(undefined) };
    lastReportCache = {
      getLastReportPayload: jest.fn().mockResolvedValue(null),
      setLastReportPayload: jest.fn().mockResolvedValue(undefined),
    };

    service = new ReportRunnerService(
      configService,
      jiraGateway,
      chatGateway,
      lastReportCache,
      aggregationService,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
  });

  it('runs daily report and returns summary', async () => {
    const summary = await service.runDailyReport('manual');

    expect(jiraGateway.fetchIssuesWithWorkLogs).toHaveBeenCalled();
    expect(aggregationService.aggregateByReportDate).toHaveBeenCalled();
    expect(chatGateway.sendReport).toHaveBeenCalled();
    expect(lastReportCache.setLastReportPayload).toHaveBeenCalled();
    expect(summary).toEqual({
      source: 'manual',
      reportDate: '2026-05-09',
      totalHours: '1h',
      userCount: 1,
    });
  });

  it('handles users without logs for report date', async () => {
    aggregationService.aggregateByReportDate.mockReturnValue({
      users: {
        Alice: { logs: { '2026-05-09': 3600 } },
        Bob: { logs: { '2026-05-08': 7200 } },
      },
      reportDate: '2026-05-09',
    });

    const summary = await service.runDailyReport('manual');

    expect(summary.userCount).toBe(1);
    expect(summary.totalHours).toBe('1h');
  });

  it('handles retry card click', async () => {
    jest.spyOn(service, 'retryDailyReportWithCache').mockResolvedValue({});

    const result = await service.handleGoogleChatEvent({
      type: 'CARD_CLICKED',
      action: { actionMethodName: 'retry_report' },
    });

    expect(result.text).toContain('successfully');
    expect(service.retryDailyReportWithCache).toHaveBeenCalledWith('google-chat-action-retry');
  });

  it('handles retry action from common.invokedFunction', async () => {
    jest.spyOn(service, 'retryDailyReportWithCache').mockResolvedValue({});

    await service.handleGoogleChatEvent({
      type: 'CARD_CLICKED',
      common: { invokedFunction: 'retry_report' },
    });

    expect(service.retryDailyReportWithCache).toHaveBeenCalledWith('google-chat-action-retry');
  });

  it('handles retry action from commonEventObject.invokedFunction', async () => {
    jest.spyOn(service, 'retryDailyReportWithCache').mockResolvedValue({});

    await service.handleGoogleChatEvent({
      type: 'CARD_CLICKED',
      commonEventObject: { invokedFunction: 'retry_report' },
    });

    expect(service.retryDailyReportWithCache).toHaveBeenCalledWith('google-chat-action-retry');
  });

  it('sends cached report immediately and triggers background refresh', async () => {
    lastReportCache.getLastReportPayload.mockResolvedValue({
      payload: {
        users: { Alice: { logs: { '2026-05-09': 3600 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9, 2026, 1:00:00 PM (+00:00)',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      jiraCheckUrl: 'https://jira.example.com/projects/BKM4',
      reportDate: '2026-05-09',
      source: 'cron',
      cachedAt: '2026-05-09T10:00:00.000Z',
    });

    const runSpy = jest.spyOn(service, 'runDailyReport').mockResolvedValue({ ok: true });

    const result = await service.retryDailyReportWithCache('chat-retry-button');

    expect(chatGateway.sendReport).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith('chat-retry-button-background-refresh');
    expect(result).toMatchObject({ cacheHit: true, backgroundRefresh: true });
  });

  it('starts background refresh when cache is missing', async () => {
    lastReportCache.getLastReportPayload.mockResolvedValue(null);
    const runSpy = jest.spyOn(service, 'runDailyReport').mockResolvedValue({ ok: true });

    const result = await service.retryDailyReportWithCache('chat-retry-button');

    expect(chatGateway.sendReport).not.toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledWith('chat-retry-button-background-refresh');
    expect(result).toMatchObject({ cacheHit: false, backgroundRefresh: true });
  });

  it('returns OK for card click when action is not retry', async () => {
    const result = await service.handleGoogleChatEvent({
      type: 'CARD_CLICKED',
      action: { actionMethodName: 'something-else' },
    });

    expect(result).toEqual({ text: 'OK' });
  });

  it('handles added to space event', async () => {
    const result = await service.handleGoogleChatEvent({ type: 'ADDED_TO_SPACE' });
    expect(result.text).toContain('connected');
  });

  it('returns OK for unknown event', async () => {
    const result = await service.handleGoogleChatEvent({ type: 'OTHER' });
    expect(result).toEqual({ text: 'OK' });
  });

  it('returns OK for empty event payload', async () => {
    const result = await service.handleGoogleChatEvent(undefined);
    expect(result).toEqual({ text: 'OK' });
  });

  it('delegates token validation', () => {
    expect(service.canTriggerWithToken('x')).toBe(true);
    expect(configService.canTriggerWithToken).toHaveBeenCalledWith('x');
  });

  it('logs debug rows only for matching author filter', async () => {
    configService.getRuntimeConfig.mockReturnValue({
      timezone: 'UTC',
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9, 2026, 1:00:00 PM (+00:00)',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      jiraQuery: 'project = BKM4',
      aggregationDebug: { enabled: true, authorFilters: ['alice'] },
      jiraCheckUrl: 'https://jira.example.com/projects/BKM4',
      jira: { jiraDomain: 'https://jira.example.com', jiraEmail: 'a', jiraApiToken: 'b', requestConfig: {} },
      chat: { mode: 'webhook', webhook: 'https://chat.example.com' },
    });

    aggregationService.aggregateByReportDate.mockReturnValue({
      users: {
        'Alice (BKM4)': { logs: { '2026-05-09': 3600 } },
        Bob: { logs: { '2026-05-09': 1800 } },
      },
      reportDate: '2026-05-09',
    });

    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    await service.runDailyReport('manual');

    expect(hasLogMessage(logSpy.mock.calls, 'author=Alice (BKM4)')).toBe(true);
    expect(hasLogMessage(logSpy.mock.calls, 'author=Bob')).toBe(false);
  });

  it('builds debug rows with fallback zero seconds for missing report date log', async () => {
    configService.getRuntimeConfig.mockReturnValue({
      timezone: 'UTC',
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9, 2026, 1:00:00 PM (+00:00)',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      jiraQuery: 'project = BKM4',
      aggregationDebug: { enabled: true, authorFilters: [] },
      jiraCheckUrl: 'https://jira.example.com/projects/BKM4',
      jira: { jiraDomain: 'https://jira.example.com', jiraEmail: 'a', jiraApiToken: 'b', requestConfig: {} },
      chat: { mode: 'webhook', webhook: 'https://chat.example.com' },
    });

    aggregationService.aggregateByReportDate.mockReturnValue({
      users: {
        Alice: { logs: { '2026-05-09': 1200 } },
        Bob: { logs: { '2026-05-08': 1200 } },
      },
      reportDate: '2026-05-09',
    });

    await service.runDailyReport('manual');
    expect(chatGateway.sendReport).toHaveBeenCalled();
  });

  it('does not log debug rows when debug is disabled', async () => {
    configService.getRuntimeConfig.mockReturnValue({
      timezone: 'UTC',
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9, 2026, 1:00:00 PM (+00:00)',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      jiraQuery: 'project = BKM4',
      aggregationDebug: { enabled: false, authorFilters: [] },
      jiraCheckUrl: 'https://jira.example.com/projects/BKM4',
      jira: { jiraDomain: 'https://jira.example.com', jiraEmail: 'a', jiraApiToken: 'b', requestConfig: {} },
      chat: { mode: 'webhook', webhook: 'https://chat.example.com' },
    });

    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    await service.runDailyReport('manual');

    expect(hasLogMessage(logSpy.mock.calls, 'Aggregation debug enabled')).toBe(false);
  });

  it('covers helper methods edge cases', () => {
    expect(service['normalizeAuthorName']('  Alice (BKM4)  ')).toBe('Alice');
    expect(service['normalizeAuthorName']('()')).toBe('()');
    expect(service['shouldLogDebugForAuthor']([], 'Anyone')).toBe(true);
    expect(service['shouldLogDebugForAuthor'](['alice'], 'alice')).toBe(true);
    expect(service['shouldLogDebugForAuthor'](['alice'], 'Bob')).toBe(false);
    expect(service['formatHoursFromSeconds'](1800)).toBe('0.5h');
  });
});
