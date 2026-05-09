import { ReportScheduler } from '../../src/report/report.scheduler';
import { ReportService } from '../../src/report/report.service';

describe('ReportScheduler', () => {
  it('logs success on successful cron run', async () => {
    const reportService = {
      runDailyReport: jest.fn().mockResolvedValue(undefined),
    };

    const scheduler = new ReportScheduler(reportService as unknown as ReportService);
    const logSpy = jest.spyOn(scheduler['logger'], 'log').mockImplementation(() => undefined);

    await scheduler.handleWeekdayReportCron();

    expect(reportService.runDailyReport.mock.calls[0][0]).toBe(
      'auto-trigger-work-log-report-cron',
    );
    expect(logSpy).toHaveBeenCalledWith('Weekday 17:00 report executed successfully');
  });

  it('logs error on failed cron run', async () => {
    const error = new Error('boom');
    const reportService = {
      runDailyReport: jest.fn().mockRejectedValue(error),
    };

    const scheduler = new ReportScheduler(reportService as unknown as ReportService);
    const errorSpy = jest.spyOn(scheduler['logger'], 'error').mockImplementation(() => undefined);

    await scheduler.handleWeekdayReportCron();

    expect(errorSpy).toHaveBeenCalledWith('Weekday 17:00 report failed', error);
  });
});
