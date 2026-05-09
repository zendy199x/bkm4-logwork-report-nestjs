import { ScheduleModule } from '@nestjs/schedule';
import { AppModule } from '../src/app.module';
import { HealthController } from '../src/health.controller';
import { ReportModule } from '../src/report/report.module';

describe('AppModule', () => {
  it('wires expected imports and controllers', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    const controllers = Reflect.getMetadata('controllers', AppModule);

    expect(imports).toBeDefined();
    expect(imports).toContain(ReportModule);
    expect(controllers).toContain(HealthController);
    expect(Array.isArray(imports)).toBe(true);
    expect(imports.length).toBeGreaterThan(0);
    expect(ScheduleModule).toBeDefined();
  });
});
