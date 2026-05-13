import { ReportConfigService } from '../../../src/report/infrastructure/report-config.service';

describe('ReportConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.REPORT_DATE;
    delete process.env.REPORT_TIMEZONE;
    delete process.env.TZ;
    delete process.env.GOOGLE_CHAT_MODE;
    delete process.env.APP_BASE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.API_BASE_PATH;
    delete process.env.CRON_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setBaseEnv() {
    process.env.TEAM_NAME = 'BKM4';
    process.env.JIRA_DOMAIN = 'https://oneline.atlassian.net';
    process.env.JIRA_EMAIL = 'bot@example.com';
    process.env.JIRA_API_TOKEN = 'token';
    process.env.WEBHOOK = 'https://chat.googleapis.com/v1/spaces/x/messages?key=a&token=b';
  }

  it('builds runtime config in webhook mode', () => {
    setBaseEnv();
    process.env.CRON_SECRET = 'secret';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    expect(config.reportTitle).toBe('-+-BKM4 WORK LOG REPORT-+-');
    expect(config.jiraQuery).toContain('project = BKM4');
    expect(config.jiraCheckUrl).toContain('/projects/BKM4');
    expect(config.chat.mode).toBe('webhook');
    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('/reports/retry');
    expect(config.chat.reportUrl).toContain('token=secret');
  });

  it('supports app mode', () => {
    setBaseEnv();
    process.env.GOOGLE_CHAT_MODE = 'app';
    process.env.GOOGLE_CHAT_SPACE = 'spaces/AAA';
    process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL = 'svc@example.com';
    process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY = String.raw`line1\nline2`;

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    expect(config.chat.mode).toBe('app');
    if (config.chat.mode !== 'app') {
      throw new Error('Expected app chat mode');
    }
    expect(config.chat.serviceAccountPrivateKey).toContain('\n');
    expect((config.chat as { reportUrl?: string }).reportUrl).toContain('/reports/retry');
  });

  it('normalizes localhost https APP_BASE_URL to http for retry url', () => {
    setBaseEnv();
    process.env.APP_BASE_URL = 'https://localhost:3000';
    process.env.CRON_SECRET = 'abc';

    const service = new ReportConfigService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('http://localhost:3000/reports/retry');
    expect(warnSpy).toHaveBeenCalledWith(
      'APP_BASE_URL uses https on localhost. Falling back to http for retry URL.',
    );
  });

  it('falls back on invalid chat mode and timezone', () => {
    setBaseEnv();
    process.env.GOOGLE_CHAT_MODE = 'invalid';
    process.env.REPORT_TIMEZONE = 'Invalid/Zone';

    const service = new ReportConfigService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const config = service.getRuntimeConfig();

    expect(config.chat.mode).toBe('webhook');
    expect(config.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to localhost when app base url is missing', () => {
    setBaseEnv();
    process.env.PORT = '4321';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('http://localhost:4321');
  });

  it('uses vercel url fallback', () => {
    setBaseEnv();
    process.env.VERCEL_URL = 'demo.vercel.app';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('https://demo.vercel.app');
  });

  it('validates required env and domain format', () => {
    setBaseEnv();
    delete process.env.JIRA_EMAIL;

    const service = new ReportConfigService();
    expect(() => service.getRuntimeConfig()).toThrow('Missing required environment variable: JIRA_EMAIL');

    process.env.JIRA_EMAIL = 'bot@example.com';
    process.env.JIRA_DOMAIN = '%%%';
    expect(() => service.getRuntimeConfig()).toThrow('Invalid JIRA_DOMAIN');
  });

  it('throws when normalized jira domain has no hostname', () => {
    setBaseEnv();
    const service = new ReportConfigService();
    const actualUrl = globalThis.URL;

    globalThis.URL = jest
      .fn()
      .mockImplementation(() => ({ hostname: '', origin: 'https://x' })) as unknown as typeof URL;

    expect(() => service['normalizeJiraDomain']('https://example.com')).toThrow(
      'Invalid JIRA_DOMAIN hostname',
    );

    globalThis.URL = actualUrl;
  });

  it('validates report date format', () => {
    setBaseEnv();
    process.env.REPORT_DATE = '2026/05/09';

    const service = new ReportConfigService();
    expect(() => service.getRuntimeConfig()).toThrow('Invalid REPORT_DATE format');
  });

  it('handles token checks and retry action', () => {
    setBaseEnv();
    const service = new ReportConfigService();

    process.env.CRON_SECRET = '';
    expect(service.canTriggerWithToken('anything')).toBe(true);

    process.env.CRON_SECRET = 'abc';
    expect(service.canTriggerWithToken('abc')).toBe(true);
    expect(service.canTriggerWithToken('x')).toBe(false);

    expect(service.isRetryAction('retry_report')).toBe(true);
    expect(service.isRetryAction('other')).toBe(false);
  });

  it('normalizes jira domain without scheme and applies default timezone on UTC TZ', () => {
    setBaseEnv();
    process.env.JIRA_DOMAIN = 'oneline.atlassian.net';
    process.env.TZ = 'UTC';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    expect(config.jira.jiraDomain).toBe('https://oneline.atlassian.net');
    expect(config.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('falls back when TZ is invalid and REPORT_TIMEZONE is empty', () => {
    setBaseEnv();
    process.env.TZ = 'Invalid/Timezone';

    const service = new ReportConfigService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const config = service.getRuntimeConfig();

    expect(config.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('parses debug flags and author filters', () => {
    setBaseEnv();
    process.env.REPORT_DEBUG = 'yes';
    process.env.REPORT_DEBUG_AUTHORS = 'Alice (BKM4), Bob';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    expect(config.aggregationDebug.enabled).toBe(true);
    expect(config.aggregationDebug.authorFilters).toEqual(['alice', 'bob']);
  });

  it('omits retry report token when CRON_SECRET is empty and warns', () => {
    setBaseEnv();
    process.env.CRON_SECRET = '';

    const service = new ReportConfigService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).not.toContain('token=');
    expect(warnSpy).toHaveBeenCalledWith(
      'CRON_SECRET is empty. Retry button will trigger a public endpoint.',
    );
  });

  it('returns null retry URL when APP_BASE_URL is invalid', () => {
    setBaseEnv();
    process.env.APP_BASE_URL = 'not-a-valid-url';

    const service = new ReportConfigService();
    const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('APP_BASE_URL is invalid. Retry button will be skipped.');
  });

  it('supports API_BASE_PATH normalization', () => {
    setBaseEnv();
    process.env.API_BASE_PATH = '/api/';
    process.env.CRON_SECRET = 'abc';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('/api/reports/retry');
  });

  it('uses default /api base path on vercel when API_BASE_PATH is empty', () => {
    setBaseEnv();
    process.env.VERCEL = '1';
    process.env.CRON_SECRET = 'abc';

    const service = new ReportConfigService();
    const config = service.getRuntimeConfig();

    if (config.chat.mode !== 'webhook') {
      throw new Error('Expected webhook chat mode');
    }
    expect(config.chat.reportUrl).toContain('/api/reports/retry');

    delete process.env.VERCEL;
  });

  it('handles missing date-time parts in formatter output', () => {
    setBaseEnv();
    const service = new ReportConfigService();
    const originalDateTimeFormat = Intl.DateTimeFormat;

    Intl.DateTimeFormat = jest
      .fn()
      .mockImplementation(() => ({
        formatToParts: () => [],
      })) as unknown as Intl.DateTimeFormatConstructor;

    const text = service['formatDisplayDateTimeInTimeZone'](new Date('2026-05-09T00:00:00Z'), 'UTC');
    expect(text).toBe(' , , ::  ()');

    Intl.DateTimeFormat = originalDateTimeFormat;
  });

  it('falls back to full raw author name when short name is empty', () => {
    setBaseEnv();
    const service = new ReportConfigService();

    expect(service['normalizeAuthorName']('()')).toBe('()');
  });
});
