import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The logger captures `import.meta.env.DEV` at module-load time, so each test
// stubs the env and re-imports the module via vi.resetModules() to exercise the
// chosen level branch.
describe('logger level (import.meta.env.DEV)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs debug and info when running in dev mode', async () => {
    // Arrange
    vi.stubEnv('DEV', true);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logger } = await import('../logger');

    // Act
    logger.app.debug('debug message');
    logger.app.info('info message');

    // Assert
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('suppresses debug and info but still warns in production mode', async () => {
    // Arrange
    vi.stubEnv('DEV', false);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('../logger');

    // Act
    logger.app.debug('debug message');
    logger.app.info('info message');
    logger.app.warn('warn message');

    // Assert
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not write errors to the console in production (routes to Sentry only)', async () => {
    // Arrange
    vi.stubEnv('DEV', false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger');

    // Act
    logger.app.error('boom');

    // Assert
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
