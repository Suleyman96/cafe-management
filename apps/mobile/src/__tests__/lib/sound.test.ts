import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(),
  setAudioModeAsync: vi.fn(async () => {}),
}));

// Local Sentry mock with vi.fn() so call counts are observable. The global
// mock-sentry helper exports noop, which can't be asserted against — same
// workaround as auth-cleanup.test.ts and realtime-patches.test.ts.
vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import * as Sentry from '@sentry/react-native';
import { setAudioModeAsync } from 'expo-audio';
import {
  __resetSoundChannelsForTests,
  __setPlayersForTests,
  cleanupSounds,
  playNewOrderSound,
} from '@/lib/sound';

type FakePlayer = {
  seekTo: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
};

function createFakePlayer(): FakePlayer {
  return {
    seekTo: vi.fn(async () => {}),
    play: vi.fn(),
  };
}

describe('sound playback serialization', () => {
  let player: FakePlayer;

  beforeEach(() => {
    __resetSoundChannelsForTests();
    player = createFakePlayer();
    // FakePlayer is structurally compatible with the AudioPlayer methods we exercise.
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);
  });

  afterEach(() => {
    __setPlayersForTests(null);
    vi.useRealTimers();
  });

  it('coalesces concurrent calls into a single play', async () => {
    const calls = Array.from({ length: 5 }, () => playNewOrderSound());
    await Promise.all(calls);

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledWith(0);
  });

  it('drops calls within the 300ms time floor', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));

    await playNewOrderSound();
    expect(player.play).toHaveBeenCalledTimes(1);

    // 200ms later — too soon, dropped.
    vi.setSystemTime(new Date('2026-04-30T12:00:00.200Z'));
    await playNewOrderSound();
    expect(player.play).toHaveBeenCalledTimes(1);

    // 400ms after the first completion — allowed.
    vi.setSystemTime(new Date('2026-04-30T12:00:00.400Z'));
    await playNewOrderSound();
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('allows a fresh play once the previous one settles and the floor passes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));
    await playNewOrderSound();

    vi.setSystemTime(new Date('2026-04-30T12:00:01Z'));
    await playNewOrderSound();

    expect(player.play).toHaveBeenCalledTimes(2);
  });
});

describe('cleanupSounds (M4 — JSI handle leak recovery)', () => {
  type FakeRemoveablePlayer = FakePlayer & { remove: ReturnType<typeof vi.fn> };

  function createRemoveablePlayer(opts: { throws?: boolean } = {}): FakeRemoveablePlayer {
    return {
      seekTo: vi.fn(async () => {}),
      play: vi.fn(),
      remove: vi.fn(() => {
        if (opts.throws) throw new Error('JSI handle invalid');
      }),
    };
  }

  beforeEach(() => {
    __resetSoundChannelsForTests();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(setAudioModeAsync).mockClear();
  });

  afterEach(() => {
    __setPlayersForTests(null);
  });

  it('calls remove() on the player and does NOT touch Sentry on the happy path', async () => {
    const player = createRemoveablePlayer();
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);

    await cleanupSounds();

    expect(player.remove).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('captures the throw to Sentry when remove() throws', async () => {
    const player = createRemoveablePlayer({ throws: true });
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);

    await cleanupSounds();

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const [err, ctx] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((err as Error).message).toBe('JSI handle invalid');
    expect((ctx as { tags?: Record<string, string> }).tags?.area).toBe('sound.cleanup');
  });

  it('force-rebuilds the audio session via setAudioModeAsync after a remove() throw', async () => {
    const player = createRemoveablePlayer({ throws: true });
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);

    await cleanupSounds();

    // Session reset is the M4 contract — without it, the next setupSounds()
    // would build a player against a corrupted native context.
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  });

  it('does NOT force-rebuild the audio session on the happy path', async () => {
    const player = createRemoveablePlayer();
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);

    await cleanupSounds();

    // No throw → no session rebuild needed. Calling setAudioModeAsync on
    // every cleanup would be wasteful and could itself fail under load.
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('captures session-reset failure separately and still nulls player refs', async () => {
    const player = createRemoveablePlayer({ throws: true });
    __setPlayersForTests(player as unknown as Parameters<typeof __setPlayersForTests>[0]);
    vi.mocked(setAudioModeAsync).mockRejectedValueOnce(new Error('session reset blew up'));

    await cleanupSounds();

    // Two captures: the original remove() throw + the reset throw.
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    const tagsForSecondCall = (
      vi.mocked(Sentry.captureException).mock.calls[1][1] as {
        tags?: Record<string, string>;
      }
    ).tags;
    expect(tagsForSecondCall?.area).toBe('sound.cleanup.session-reset');
  });
});
