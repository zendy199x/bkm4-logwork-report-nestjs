import { ReportRunnerService } from '../../src/report/application/report-runner.service';
import { ReportService } from '../../src/report/report.service';

describe('ReportService', () => {
  it('delegates to runner service', async () => {
    const runner = {
      runDailyReport: jest.fn().mockResolvedValue({ ok: true }),
      retryDailyReportWithCache: jest.fn().mockResolvedValue({ cacheHit: true }),
      canTriggerWithToken: jest.fn().mockReturnValue(true),
      handleGoogleChatEvent: jest.fn().mockResolvedValue({ text: 'OK' }),
    };

    const service = new ReportService(runner as unknown as ReportRunnerService);

    await expect(service.runDailyReport('source')).resolves.toEqual({ ok: true });
    await expect(service.retryDailyReportWithCache('retry-source')).resolves.toEqual({ cacheHit: true });
    expect(service.canTriggerWithToken('x')).toBe(true);
    await expect(service.handleGoogleChatEvent({})).resolves.toEqual({ text: 'OK' });

    expect(runner.runDailyReport.mock.calls[0][0]).toBe('source');
    expect(runner.retryDailyReportWithCache.mock.calls[0][0]).toBe('retry-source');
  });
});
