import axios from 'axios';
import { JWT } from 'google-auth-library';
import { ChatMode } from '../../../src/report/domain/report.types';
import { ChatDeliveryService } from '../../../src/report/infrastructure/chat-delivery.service';

const authorizeMock = jest.fn().mockResolvedValue({ access_token: 'mock-token' });

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({
    authorize: authorizeMock,
  })),
}));

describe('ChatDeliveryService', () => {
  const postMock = jest.mocked(axios.post);
  const jwtMock = jest.mocked(JWT);

  beforeEach(() => {
    jest.clearAllMocks();
    authorizeMock.mockResolvedValue({ access_token: 'mock-token' });
  });

  it('sends webhook text and card payload', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com', reportUrl: 'https://app/retry' },
      {
        users: { Alice: { logs: { '2026-05-09': 3600 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('renders no-data report text', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com' },
      {
        users: {},
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(postMock).toHaveBeenCalledWith(
      'https://chat.example.com',
      expect.objectContaining({ text: expect.stringContaining('No work log data at this time') }),
    );
  });

  it('sends app-mode message with bearer token', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      {
        mode: ChatMode.APP,
        space: 'spaces/AAA',
        serviceAccountEmail: 'svc@example.com',
        serviceAccountPrivateKey: 'key',
      },
      {
        users: { Bob: { logs: { '2026-05-09': 1200 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(jwtMock).toHaveBeenCalled();
    expect(JSON.stringify(postMock.mock.calls)).toContain('Bearer mock-token');
  });

  it('throws if webhook mode has no webhook', async () => {
    const service = new ChatDeliveryService();

    await expect(
      service.sendReport(
        { mode: ChatMode.WEBHOOK, webhook: '' },
        {
          users: {},
          reportDate: '2026-05-09',
          reportDateTimeLabel: 'May 9',
          reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        },
        'https://jira/check',
      ),
    ).rejects.toThrow('Missing webhook URL for webhook mode');
  });

  it('warns when card send fails after text was sent', async () => {
    postMock.mockImplementationOnce(async () => ({})).mockRejectedValueOnce(new Error('card-failed'));
    const service = new ChatDeliveryService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com', reportUrl: 'https://app/retry' },
      {
        users: { Alice: { logs: { '2026-05-09': 600 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(warnSpy).toHaveBeenCalled();
  });

  it('throws when app-mode cannot obtain access token', async () => {
    authorizeMock.mockResolvedValueOnce({});

    const service = new ChatDeliveryService();

    await expect(
      service.sendReport(
        {
          mode: ChatMode.APP,
          space: 'spaces/AAA',
          serviceAccountEmail: 'svc@example.com',
          serviceAccountPrivateKey: 'key',
        },
        {
          users: { Bob: { logs: { '2026-05-09': 1200 } } },
          reportDate: '2026-05-09',
          reportDateTimeLabel: 'May 9',
          reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        },
        'https://jira/check',
      ),
    ).rejects.toThrow('Failed to obtain Google Chat access token');
  });

  it('caps report rows and formats totals via helper', () => {
    const service = new ChatDeliveryService();
    const users: Record<string, { logs: Record<string, number> }> = {};
    for (let index = 1; index <= 55; index += 1) {
      users[`User ${index}`] = { logs: { '2026-05-09': 3600 } };
    }

    const output = service['buildChatTextReport']({
      users,
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
    });

    expect(output).toContain('Total');
    expect(output).toContain('50. User 50');
    expect(output).not.toContain('51. User 51');
    expect(service['formatHoursFromSeconds'](1800)).toBe('0.5h');
  });

  it('filters out users with zero seconds in helper output', () => {
    const service = new ChatDeliveryService();
    const output = service['buildChatTextReport']({
      users: {
        Alice: { logs: { '2026-05-09': 0 } },
        Bob: { logs: { '2026-05-09': 3600 } },
      },
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
    });

    expect(output).toContain('Bob');
    expect(output).not.toContain('Alice');
  });
});
