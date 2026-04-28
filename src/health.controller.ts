import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'render-nest-api',
      now: new Date().toISOString(),
    };
  }
}
