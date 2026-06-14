import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeRestEndNotification, showRestEndNotification } from '../notificationService';

// Rest-end screen-off notification helpers. These guard on permission and route
// through the service-worker registration (the iOS-safe path).

const showNotification = vi.fn();
const close = vi.fn();
const getNotifications = vi.fn();

const setPermission = (p: NotificationPermission) => {
  // @ts-expect-error — test stub of the Notification global.
  globalThis.Notification = { permission: p };
};

const setRegistration = (reg: unknown) => {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(reg) },
  });
};

describe('showRestEndNotification', () => {
  beforeEach(() => {
    showNotification.mockClear();
    close.mockClear();
    getNotifications.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when permission is not granted', async () => {
    // Arrange
    setPermission('default');
    setRegistration({ showNotification });

    // Act
    await showRestEndNotification('60ק״ג × 8');

    // Assert — gated: no notification shown without permission.
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows a rest-end notification via the SW registration when granted', async () => {
    // Arrange
    setPermission('granted');
    setRegistration({ showNotification });

    // Act
    await showRestEndNotification('60ק״ג × 8', [200, 100, 200]);

    // Assert — correct title, tag, renotify, vibrate, and the body passed through.
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0] as [string, Record<string, unknown>];
    expect(title).toBe('המנוחה הסתיימה');
    expect(options.body).toBe('60ק״ג × 8');
    expect(options.tag).toBe('rest-end');
    expect(options.renotify).toBe(true);
    expect(options.vibrate).toEqual([200, 100, 200]);
  });

  it('omits vibrate when none is provided', async () => {
    // Arrange
    setPermission('granted');
    setRegistration({ showNotification });

    // Act
    await showRestEndNotification('הסט הבא');

    // Assert
    const [, options] = showNotification.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.vibrate).toBeUndefined();
  });
});

describe('closeRestEndNotification', () => {
  beforeEach(() => {
    close.mockClear();
    getNotifications.mockReset();
  });

  it('closes any on-screen rest-end notification by tag', async () => {
    // Arrange
    getNotifications.mockResolvedValue([{ close }, { close }]);
    setRegistration({ getNotifications });

    // Act
    await closeRestEndNotification();

    // Assert — queried by the shared tag and closed every match.
    expect(getNotifications).toHaveBeenCalledWith({ tag: 'rest-end' });
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('no-ops without a service-worker registration', async () => {
    // Arrange
    setRegistration(null);

    // Act + Assert — must not throw.
    await expect(closeRestEndNotification()).resolves.toBeUndefined();
  });
});
