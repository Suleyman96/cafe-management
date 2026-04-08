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
  if (newOrderSound) {
    await newOrderSound.unloadAsync();
  }
  if (waiterCallSound) {
    await waiterCallSound.unloadAsync();
  }
}
