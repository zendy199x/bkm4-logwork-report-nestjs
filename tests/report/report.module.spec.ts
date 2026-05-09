import { ReportController } from '../../src/report/report.controller';
import { ReportModule } from '../../src/report/report.module';
import { ReportService } from '../../src/report/report.service';

describe('ReportModule', () => {
  it('declares controller and exports report service', () => {
    const controllers = Reflect.getMetadata('controllers', ReportModule);
    const exportsList = Reflect.getMetadata('exports', ReportModule);
    const providers = Reflect.getMetadata('providers', ReportModule);

    expect(controllers).toContain(ReportController);
    expect(exportsList).toContain(ReportService);
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('omits scheduler providers when running on vercel', () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    jest.resetModules();

    const moduleRef = require('../../src/report/report.module');
    const vercelProviders = Reflect.getMetadata('providers', moduleRef.ReportModule);

    expect(vercelProviders.some((provider) => provider?.name === 'ReportScheduler')).toBe(false);

    process.env.VERCEL = originalVercel;
  });
});
