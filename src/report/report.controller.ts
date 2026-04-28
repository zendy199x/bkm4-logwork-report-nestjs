import {
  Controller,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('run')
  async run(
    @Headers('x-cron-secret') cronSecretHeader: string | undefined,
    @Query('token') tokenFromQuery: string | undefined,
  ) {
    const token = cronSecretHeader || tokenFromQuery || '';

    if (!this.reportService.canTriggerWithToken(token)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    const result = await this.reportService.runDailyReport('manual-api-trigger');
    return {
      ok: true,
      ...result,
    };
  }
}
