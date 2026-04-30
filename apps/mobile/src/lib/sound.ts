import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * In-app sounds are FOREGROUND-ONLY by design.
 *
 * `shouldPlayInBackground: false` keeps the audio session inactive when the
 * app is backgrounded — battery-friendly, but it also means a backgrounded
 * app cannot play these sounds even if a realtime callback fired (which it
 * won't anyway, since JS is paused). The kitchen relies on OS push
 * notifications for backgrounded alerts, configured server-side and routed
 * through the Android `default` channel set up in lib/notifications.ts.
 *
 * If you change this contract (e.g. enable `shouldPlayInBackground`), also
 * update the README and verify that the server-side push pipeline still owns
 * the background path — otherwise the kitchen will silently miss orders.
 */

let newOrderPlayer: AudioPlayer | null = null;
let waiterCallPlayer: AudioPlayer | null = null;
let soundsAvailable = false;

/**
 * Serialize and rate-limit sound playback per player. Five orders inserted
 * within the same render tick must produce ONE audible cue, not five
 * overlapping ones. The mutex coalesces concurrent calls; the time floor
 * drops calls that arrive within MIN_GAP_MS of the previous completion.
 */
const MIN_GAP_MS = 300;
type Channel = { inFlight: Promise<void> | null; lastPlayedAt: number };
const channels = new Map<AudioPlayer, Channel>();

function getChannel(player: AudioPlayer): Channel {
  let ch = channels.get(player);
  if (!ch) {
    ch = { inFlight: null, lastPlayedAt: 0 };
    channels.set(player, ch);
  }
  return ch;
}

export function __resetSoundChannelsForTests(): void {
  channels.clear();
}

export function __setPlayersForTests(p: AudioPlayer | null): void {
  newOrderPlayer = p;
  waiterCallPlayer = p;
  soundsAvailable = p !== null;
}

export async function setupSounds() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });

    newOrderPlayer = createAudioPlayer(require('../../assets/sounds/new_order.wav'));
    // Reuse same player until a separate waiter-call sound asset is added.
    // cleanupSounds dedupes when the two refs point to the same object.
    waiterCallPlayer = newOrderPlayer;
    soundsAvailable = true;
  } catch {
    // Sound files may not be available in development/Expo Go — notifications
    // still work without sound.
    soundsAvailable = false;
  }
}

async function replay(player: AudioPlayer) {
  // seekTo(0) + play() replaces expo-av's replayAsync. seekTo is async
  // (resolves once the seek lands); play is fire-and-forget.
  await player.seekTo(0);
  player.play();
}

async function playOnce(player: AudioPlayer): Promise<void> {
  const ch = getChannel(player);
  // Mutex: while a play is in flight, return that same promise so concurrent
  // callers coalesce. The .finally below clears it once the play settles.
  if (ch.inFlight) return ch.inFlight;
  // Time floor: drop calls that arrive too soon after the last completion.
  const now = Date.now();
  if (ch.lastPlayedAt !== 0 && now - ch.lastPlayedAt < MIN_GAP_MS) return;

  const run = (async () => {
    try {
      await replay(player);
    } catch {
      // Sound is non-critical — silently fail.
    }
  })().finally(() => {
    ch.lastPlayedAt = Date.now();
    ch.inFlight = null;
  });

  ch.inFlight = run;
  return run;
}

export async function playNewOrderSound() {
  if (!soundsAvailable || !newOrderPlayer) return;
  await playOnce(newOrderPlayer);
}

export async function playWaiterCallSound() {
  if (!soundsAvailable || !waiterCallPlayer) return;
  await playOnce(waiterCallPlayer);
}

export async function cleanupSounds() {
  try {
    newOrderPlayer?.remove();
  } catch {
    // Player may already be removed.
  }

  // Only remove waiterCallPlayer if it's a different instance than newOrderPlayer
  // (currently they alias, but stay defensive in case the assets diverge).
  if (waiterCallPlayer && waiterCallPlayer !== newOrderPlayer) {
    try {
      waiterCallPlayer.remove();
    } catch {
      // Player may already be removed.
    }
  }

  newOrderPlayer = null;
  waiterCallPlayer = null;
  soundsAvailable = false;
  channels.clear();
}
