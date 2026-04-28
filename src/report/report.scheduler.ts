import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ReportService } from './report.service';

export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(private readonly reportService: ReportService) {}

  @Cron('0 0 16 * * 1-5', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleWeekdayReportCron() {
    try {
      await this.reportService.runDailyReport('nestjs-auto-cron');
      this.logger.log('Weekday 16:00 report executed successfully');
    } catch (error) {
      this.logger.error('Weekday 16:00 report failed', error as Error);
    }
  }
}
