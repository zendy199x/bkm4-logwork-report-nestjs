import { ReportDate, TeamName, Timezone } from '../../../src/report/domain/value-objects';

describe('TeamName', () => {
  it('creates a valid team name and report title', () => {
    const teamName = TeamName.from('  BKM4  ');

    expect(teamName.value).toBe('BKM4');
    expect(teamName.toReportTitle()).toBe('-+-BKM4 WORK LOG REPORT-+-');
  });

  it('throws for empty team name', () => {
    expect(() => TeamName.from('   ')).toThrow('TEAM_NAME must not be empty');
  });
});

describe('Timezone', () => {
  it('creates timezone from valid value', () => {
    const timezone = Timezone.from(' UTC ');

    expect(timezone.value).toBe('UTC');
  });

  it('throws for empty timezone', () => {
    expect(() => Timezone.from('')).toThrow('Timezone must not be empty');
  });

  it('throws for invalid timezone', () => {
    expect(() => Timezone.from('Invalid/Timezone')).toThrow('Invalid timezone: Invalid/Timezone');
  });

  it('formats date in timezone', () => {
    const timezone = Timezone.from('UTC');
    const formatted = timezone.formatDate(new Date('2026-05-09T10:11:12.000Z'));

    expect(formatted).toBe('2026-05-09');
  });
});

describe('ReportDate', () => {
  it('creates report date from valid value', () => {
    const reportDate = ReportDate.from(' 2026-05-09 ');

    expect(reportDate.value).toBe('2026-05-09');
  });

  it('throws for invalid report date format', () => {
    expect(() => ReportDate.from('2026/05/09')).toThrow(
      'Invalid REPORT_DATE format: 2026/05/09. Expected YYYY-MM-DD',
    );
  });

  it('creates report date from date and timezone', () => {
    const timezone = Timezone.from('UTC');
    const reportDate = ReportDate.fromDate(new Date('2026-05-09T00:00:00.000Z'), timezone);

    expect(reportDate.value).toBe('2026-05-09');
  });

  it('compares with string and ReportDate', () => {
    const reportDate = ReportDate.from('2026-05-09');

    expect(reportDate.equals('2026-05-09')).toBe(true);
    expect(reportDate.equals('2026-05-08')).toBe(false);
    expect(reportDate.equals(ReportDate.from('2026-05-09'))).toBe(true);
    expect(reportDate.equals(ReportDate.from('2026-05-10'))).toBe(false);
  });
});
