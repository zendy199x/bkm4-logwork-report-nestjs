export class TeamName {
  private constructor(public readonly value: string) {}

  static from(rawValue: string): TeamName {
    const value = rawValue.trim();
    if (!value) {
      throw new Error('TEAM_NAME must not be empty');
    }

    return new TeamName(value);
  }

  toReportTitle(): string {
    return `-+-${this.value} WORK LOG REPORT-+-`;
  }
}

export class Timezone {
  private constructor(public readonly value: string) {}

  static from(rawValue: string): Timezone {
    const value = rawValue.trim();
    if (!value) {
      throw new Error('Timezone must not be empty');
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
      return new Timezone(value);
    } catch {
      throw new Error(`Invalid timezone: ${rawValue}`);
    }
  }

  formatDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.value,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }
}

export class ReportDate {
  private constructor(public readonly value: string) {}

  static from(rawValue: string): ReportDate {
    const value = rawValue.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`Invalid REPORT_DATE format: ${rawValue}. Expected YYYY-MM-DD`);
    }

    return new ReportDate(value);
  }

  static fromDate(date: Date, timezone: Timezone): ReportDate {
    return ReportDate.from(timezone.formatDate(date));
  }

  equals(value: ReportDate | string): boolean {
    if (typeof value === 'string') {
      return this.value === value;
    }

    return this.value === value.value;
  }
}