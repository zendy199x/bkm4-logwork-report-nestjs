import { HealthController } from '../src/health.controller';

describe('HealthController', () => {
  const originalTeamName = process.env.TEAM_NAME;

  afterEach(() => {
    process.env.TEAM_NAME = originalTeamName;
  });

  it('returns home page html', () => {
    process.env.TEAM_NAME = 'BKM4';
    const controller = new HealthController();

    const html = controller.home();

    expect(html).toContain('Work Log Report API');
    expect(html).toContain('/reports/run');
  });

  it('returns help page html', () => {
    process.env.TEAM_NAME = 'BKM4';
    const controller = new HealthController();

    const html = controller.help();

    expect(html).toContain('Setup Guide');
    expect(html).toContain('Deploy To Vercel');
  });

  it('keeps readme alias method for backward compatibility', () => {
    process.env.TEAM_NAME = 'BKM4';
    const controller = new HealthController();

    expect(controller.readme()).toContain('Setup Guide');
  });

  it('returns health payload', () => {
    process.env.TEAM_NAME = 'BKM4';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.ok).toBe(true);
    expect(payload.service).toBe('bkm4-logwork-report-api');
    expect(new Date(payload.now).toISOString()).toBe(payload.now);
  });

  it('falls back slug to team when TEAM_NAME has no alphanumeric characters', () => {
    process.env.TEAM_NAME = '!!!';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('team-logwork-report-api');
  });

  it('falls back team name to BKM4 when TEAM_NAME is blank', () => {
    process.env.TEAM_NAME = '   ';
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('bkm4-logwork-report-api');
  });

  it('falls back team name to BKM4 when TEAM_NAME is undefined', () => {
    delete process.env.TEAM_NAME;
    const controller = new HealthController();

    const payload = controller.health();

    expect(payload.service).toBe('bkm4-logwork-report-api');
  });
});
