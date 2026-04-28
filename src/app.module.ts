import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthController } from './health.controller';
import { ReportModule } from './report/report.module';

@Module({
  imports: [ScheduleModule.forRoot(), ReportModule],
  controllers: [HealthController],
})
export class AppModule {}
