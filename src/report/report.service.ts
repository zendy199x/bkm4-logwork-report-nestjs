import { Injectable } from '@nestjs/common';
import { ReportRunnerService } from './application/report-runner.service';

@Injectable()
export class ReportService {
  constructor(private readonly reportRunnerService: ReportRunnerService) {}

  async runDailyReport(source: string) {
    return this.reportRunnerService.runDailyReport(source);
  }

  canTriggerWithToken(token: string): boolean {
    return this.reportRunnerService.canTriggerWithToken(token);
  }

  async handleGoogleChatEvent(event: unknown): Promise<Record<string, unknown>> {
    return this.reportRunnerService.handleGoogleChatEvent(event);
  }
}
