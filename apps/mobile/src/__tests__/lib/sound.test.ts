import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(),
  setAudioModeAsync: vi.fn(async () => {}),
}));

import { __resetSoundChannelsForTests, __setPlayersForTests, playNewOrderSound } from '@/lib/sound';

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
