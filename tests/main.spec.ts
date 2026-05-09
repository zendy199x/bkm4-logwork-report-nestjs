
describe('main entrypoint', () => {
  const originalPort = process.env.PORT;
  const originalExitCode = process.exitCode;

  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  afterEach(() => {
    process.env.PORT = originalPort;
    process.exitCode = originalExitCode;
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('@nestjs/core');
    jest.unmock('@nestjs/common');
  });

  it('boots successfully and listens on configured port', async () => {
    const listen = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({ listen });

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
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

    process.env.PORT = '4444';

    jest.isolateModules(() => {
      require('../src/main');
    });

    await flush();

    expect(create).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(4444, '0.0.0.0');
    expect(log).toHaveBeenCalledWith('HTTP server is running on port 4444', 'Bootstrap');
    expect(error).not.toHaveBeenCalled();
  });

  it('uses default port 3000 when PORT is not set', async () => {
    const listen = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({ listen });

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
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

    delete process.env.PORT;

    jest.isolateModules(() => {
      require('../src/main');
    });

    await flush();

    expect(create).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(3000, '0.0.0.0');
    expect(log).toHaveBeenCalledWith('HTTP server is running on port 3000', 'Bootstrap');
    expect(error).not.toHaveBeenCalled();
  });

  it('sets exit code when bootstrap fails', async () => {
    const create = jest.fn().mockRejectedValue(new Error('boot-fail'));

    jest.doMock('@nestjs/core', () => ({
      NestFactory: { create },
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
      require('../src/main');
    });

    await flush();

    expect(create).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Application failed to start', expect.any(Error), 'Bootstrap');
    expect(process.exitCode).toBe(1);
  });
});
