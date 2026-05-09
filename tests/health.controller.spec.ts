import { HealthController } from '../src/health.controller';

describe('HealthController', () => {
  const originalTeamName = process.env.TEAM_NAME;
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    process.env.TEAM_NAME = originalTeamName;
    process.env.VERCEL = originalVercel;
  });

  it('returns home page html', () => {
    process.env.TEAM_NAME = 'TEAM';
    const controller = new HealthController();

    const html = controller.home();

    expect(html).toContain('Jira Team Work Log Tracking API');
    expect(html).toContain('/reports/run');
  });

  it('returns help page html', () => {
    process.env.TEAM_NAME = 'TEAM';
    const controller = new HealthController();

    const html = controller.help();

    expect(html).toContain('Setup Guide');
    expect(html).toContain('Deploy To Vercel');
  });

  it('keeps readme alias method for backward compatibility', () => {
    process.env.TEAM_NAME = 'TEAM';
    const controller = new HealthController();

    expect(controller.readme()).toContain('Setup Guide');
  });

  it('returns health payload', () => {
    process.env.TEAM_NAME = 'TEAM';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.ok).toBe(true);
    expect(payload.service).toBe('team-jira-work-log-tracking-api');
    expect(new Date(payload.now).toISOString()).toBe(payload.now);
  });

  it('falls back slug to team when TEAM_NAME has no alphanumeric characters', () => {
    process.env.TEAM_NAME = '!!!';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('team-jira-work-log-tracking-api');
  });

  it('falls back team name to TEAM when TEAM_NAME is blank', () => {
    process.env.TEAM_NAME = '   ';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('team-jira-work-log-tracking-api');
  });

  it('falls back team name to TEAM when TEAM_NAME is undefined', () => {
    delete process.env.TEAM_NAME;
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('team-jira-work-log-tracking-api');
  });

  it('prefixes endpoints with /api when running on Vercel', () => {
    process.env.TEAM_NAME = 'TEAM';
    process.env.VERCEL = '1';
    const controller = new HealthController();

    expect(controller['endpoint']('/')).toBe('/api');
    expect(controller['endpoint']('/health')).toBe('/api/health');
    expect(controller['endpoint']('help')).toBe('/api/help');
  });
});
