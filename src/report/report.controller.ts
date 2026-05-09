import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    Post,
    Query,
    UnauthorizedException,
} from '@nestjs/common';

import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

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

  @Get('retry')
  async retry(@Query('token') token = '') {
    if (!this.reportService.canTriggerWithToken(token)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    const result = await this.reportService.runDailyReport('chat-retry-button');
    return {
      ok: true,
      message: 'Report triggered again successfully',
      ...result,
    };
  }

  @Post('chat/events')
  @HttpCode(200)
  async handleGoogleChatEvent(@Body() event: unknown) {
    return this.reportService.handleGoogleChatEvent(event);
  }
}
