import { UnauthorizedException } from '@nestjs/common';
import { ReportController } from '../../src/report/report.controller';
import { ReportService } from '../../src/report/report.service';

describe('ReportController', () => {
  const service = {
    canTriggerWithToken: jest.fn(),
    runDailyReport: jest.fn(),
    handleGoogleChatEvent: jest.fn(),
  };

  const controller = new ReportController(service as unknown as ReportService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs report for authorized run endpoint', async () => {
    service.canTriggerWithToken.mockReturnValue(true);
    service.runDailyReport.mockResolvedValue({ reportDate: '2026-05-09' });

    await expect(controller.run('header-token', undefined)).resolves.toEqual({
      ok: true,
      reportDate: '2026-05-09',
    });
  });

  it('throws unauthorized for run endpoint', async () => {
    service.canTriggerWithToken.mockReturnValue(false);

    await expect(controller.run(undefined, 'query-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses query token when header token is missing', async () => {
    service.canTriggerWithToken.mockReturnValue(true);
    service.runDailyReport.mockResolvedValue({ ok: true });

    await controller.run(undefined, 'query-token');

    expect(service.canTriggerWithToken).toHaveBeenCalledWith('query-token');
  });

  it('prefers header token over query token', async () => {
    service.canTriggerWithToken.mockReturnValue(true);
    service.runDailyReport.mockResolvedValue({ ok: true });

    await controller.run('header-token', 'query-token');

    expect(service.canTriggerWithToken).toHaveBeenCalledWith('header-token');
  });

  it('uses empty token when no header and query tokens are provided', async () => {
    service.canTriggerWithToken.mockReturnValue(false);

    await expect(controller.run(undefined, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.canTriggerWithToken).toHaveBeenCalledWith('');
  });

  it('runs retry endpoint when authorized', async () => {
    service.canTriggerWithToken.mockReturnValue(true);
    service.runDailyReport.mockResolvedValue({ source: 'x' });

    await expect(controller.retry('token')).resolves.toEqual({
      ok: true,
      message: 'Report triggered again successfully',
      source: 'x',
    });
  });

  it('throws unauthorized for retry endpoint', async () => {
    service.canTriggerWithToken.mockReturnValue(false);

    await expect(controller.retry('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses empty token by default in retry endpoint', async () => {
    service.canTriggerWithToken.mockReturnValue(true);
    service.runDailyReport.mockResolvedValue({ ok: true });

    await controller.retry();

    expect(service.canTriggerWithToken).toHaveBeenCalledWith('');
  });

  it('forwards google chat event payload', async () => {
    service.handleGoogleChatEvent.mockResolvedValue({ text: 'OK' });

    await expect(controller.handleGoogleChatEvent({ type: 'X' })).resolves.toEqual({ text: 'OK' });
  });
});
