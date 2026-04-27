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

export async function playNewOrderSound() {
  try {
    if (soundsAvailable && newOrderPlayer) {
      await replay(newOrderPlayer);
    }
  } catch {
    // Sound is non-critical — silently fail.
  }
}

export async function playWaiterCallSound() {
  try {
    if (soundsAvailable && waiterCallPlayer) {
      await replay(waiterCallPlayer);
    }
  } catch {
    // Sound is non-critical — silently fail.
  }
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
}
