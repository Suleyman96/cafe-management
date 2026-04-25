import { Audio } from 'expo-av';

let newOrderSound: Audio.Sound | null = null;
let waiterCallSound: Audio.Sound | null = null;
let soundsAvailable = false;

export async function setupSounds() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound: orderSound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/new_order.wav'),
    );
    newOrderSound = orderSound;
    waiterCallSound = orderSound; // Reuse same sound until separate file is added
    soundsAvailable = true;
  } catch {
    // Sound files may not be available in development/Expo Go — notifications still work without sound
    soundsAvailable = false;
  }
}

export async function playNewOrderSound() {
  try {
    if (soundsAvailable && newOrderSound) {
      await newOrderSound.replayAsync();
    }
  } catch {
    // Silently fail — sound is non-critical
  }
}

export async function playWaiterCallSound() {
  try {
    if (soundsAvailable && waiterCallSound) {
      await waiterCallSound.replayAsync();
    }
  } catch {
    // Silently fail — sound is non-critical
  }
}

export async function cleanupSounds() {
  try {
    if (newOrderSound) {
      await newOrderSound.unloadAsync();
    }
  } catch {
    // Sound may already be unloaded
  }

  // Only unload waiterCallSound if it's a different object than newOrderSound
  if (waiterCallSound && waiterCallSound !== newOrderSound) {
    try {
      await waiterCallSound.unloadAsync();
    } catch {
      // Sound may already be unloaded
    }
  }

  newOrderSound = null;
  waiterCallSound = null;
  soundsAvailable = false;
}
