import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestPermissionsAsyncMock = vi.fn();

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsyncMock(...args),
  getExpoPushTokenAsync: vi.fn(),
  AndroidImportance: { MAX: 5 },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: {} } } },
}));

vi.mock('expo-device', () => ({ isDevice: false }));

import { requestPermissionsWithTimeout } from '@/lib/notifications';

describe('requestPermissionsWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestPermissionsAsyncMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the permission status when the dialog responds in time', async () => {
    requestPermissionsAsyncMock.mockResolvedValueOnce({ status: 'granted' });
    const result = await requestPermissionsWithTimeout(5_000);
    expect(result).toEqual({ status: 'granted' });
  });

  it("resolves with 'undetermined' when the dialog hangs past the timeout", async () => {
    requestPermissionsAsyncMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
    const promise = requestPermissionsWithTimeout(5_000);
    await vi.advanceTimersByTimeAsync(5_001);
    const result = await promise;
    expect(result).toEqual({ status: 'undetermined' });
  });

  it('honors a custom timeout', async () => {
    requestPermissionsAsyncMock.mockReturnValueOnce(new Promise(() => {}));
    const promise = requestPermissionsWithTimeout(1_000);
    await vi.advanceTimersByTimeAsync(1_001);
    const result = await promise;
    expect(result.status).toBe('undetermined');
  });
});
