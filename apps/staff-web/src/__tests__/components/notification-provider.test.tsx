import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import type { Staff } from '@/types';
import { mockAdminStaff } from '../helpers/mock-auth';

beforeEach(() => {
  useAuthStore.setState({ staff: mockAdminStaff as Staff, isLoading: false });
  channelRegistry.teardownAll();

  // Restore the chainable channel mock — vi.clearAllMocks blanks call history
  // but doesn't restore .on/.subscribe to chain `this`.
  (supabase.channel as ReturnType<typeof vi.fn>).mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });
});

describe('NotificationProvider — channel registry integration', () => {
  it('registers exactly one entry on mount and unregisters on unmount', () => {
    const { unmount } = render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    expect(channelRegistry.size()).toBe(1);
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    // Channel name is suffixed so multi-tab opens of the same provider don't
    // collide on the shared supabase client.
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringMatching(/^notify-all:/));

    unmount();
    expect(channelRegistry.size()).toBe(0);
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('resubscribeAll() (TOKEN_REFRESHED) tears down the stale channel and creates a fresh one', () => {
    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    const removeBefore = (supabase.removeChannel as ReturnType<typeof vi.fn>).mock.calls.length;

    // Simulates the RealtimeAuthBridge reacting to TOKEN_REFRESHED. Without
    // this rebind, the kitchen view stops receiving alerts after ~55 min.
    channelRegistry.resubscribeAll();

    expect(supabase.removeChannel).toHaveBeenCalledTimes(removeBefore + 1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(channelRegistry.size()).toBe(1);
  });

  it('does not subscribe before tenantId is available', () => {
    useAuthStore.setState({ staff: null, isLoading: false });

    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(channelRegistry.size()).toBe(0);
  });

  it('produces distinct registry keys per provider instance (multi-tab safety)', () => {
    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );
    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>,
    );

    expect(channelRegistry.size()).toBe(2);
    const channelMock = supabase.channel as ReturnType<typeof vi.fn>;
    const names = channelMock.mock.calls.map((c) => c[0] as string);
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).toMatch(/^notify-all:/);
    expect(names[1]).toMatch(/^notify-all:/);
  });
});
