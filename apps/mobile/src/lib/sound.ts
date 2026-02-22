import { Audio } from 'expo-av';

let newOrderSound: Audio.Sound | null = null;
let waiterCallSound: Audio.Sound | null = null;

export async function setupSounds() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    // Load new order sound
    const { sound: orderSound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/new-order.wav'),
    );
    newOrderSound = orderSound;

    // Load waiter call sound
    const { sound: callSound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/waiter-call.wav'),
    );
    waiterCallSound = callSound;
  } catch (error) {
    console.error('Error loading sounds:', error);
  }
}

export async function playNewOrderSound() {
  try {
    if (newOrderSound) {
      await newOrderSound.replayAsync();
    }
  } catch (error) {
    console.error('Error playing new order sound:', error);
  }
}

export async function playWaiterCallSound() {
  try {
    if (waiterCallSound) {
      await waiterCallSound.replayAsync();
    }
  } catch (error) {
    console.error('Error playing waiter call sound:', error);
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
