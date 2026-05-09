
describe('cron runner entrypoint', () => {
  const originalExitCode = process.exitCode;

  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('@nestjs/core');
    jest.unmock('@nestjs/common');
  });

  it('runs cron successfully', async () => {
    const runDailyReport = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const app = {
      get: jest.fn().mockReturnValue({ runDailyReport }),
      close,
    };

    const createApplicationContext = jest.fn().mockResolvedValue(app);

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { createApplicationContext },
    }));

    const log = jest.fn();
    const error = jest.fn();
    jest.doMock('@nestjs/common', () => {
      const actual = jest.requireActual('@nestjs/common');
      return {
        ...actual,
        Logger: {
          ...actual.Logger,
          log,
          error,
        },
      };
    });

    jest.isolateModules(() => {
      require('../src/cron-runner');
    });

    await flush();

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(runDailyReport).toHaveBeenCalledWith('render-cron-job');
    expect(close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Cron job executed successfully', 'CronRunner');
    expect(error).not.toHaveBeenCalled();
  });

  it('sets exit code when cron run fails', async () => {
    const runDailyReport = jest.fn().mockRejectedValue(new Error('cron-fail'));
    const close = jest.fn().mockResolvedValue(undefined);
    const app = {
      get: jest.fn().mockReturnValue({ runDailyReport }),
      close,
    };

    const createApplicationContext = jest.fn().mockResolvedValue(app);

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { createApplicationContext },
    }));

    const log = jest.fn();
    const error = jest.fn();
    jest.doMock('@nestjs/common', () => {
      const actual = jest.requireActual('@nestjs/common');
      return {
        ...actual,
        Logger: {
          ...actual.Logger,
          log,
          error,
        },
      };
    });

    jest.isolateModules(() => {
      require('../src/cron-runner');
    });

    await flush();

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Cron job failed', expect.any(Error), 'CronRunner');
    expect(process.exitCode).toBe(1);
  });
});
