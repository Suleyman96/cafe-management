'use client';

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

export type AudioChannel = 'orders' | 'waiterCalls' | 'alerts';
export type AudioPrefs = Record<AudioChannel, boolean>;

export const DEFAULT_AUDIO_PREFS: AudioPrefs = { orders: true, waiterCalls: true, alerts: true };
const LEGACY_AUDIO_KEY = 'staff-audio-enabled';

function audioPrefsStorageKey(staffId: string | undefined): string {
  // Per-staff key so a kiosk shared by multiple staff each remembers its own
  // mute preferences. Falls back to a device-global key when no staff is
  // bound (pre-auth boot) — that branch only writes defaults so it can't
  // leak one user's choices into another's slot.
  return staffId ? `staff-audio-prefs:${staffId}` : 'staff-audio-prefs';
}

function readStoredAudioPrefs(staffId: string | undefined): AudioPrefs {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_PREFS;
  try {
    const raw = localStorage.getItem(audioPrefsStorageKey(staffId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        orders: typeof parsed.orders === 'boolean' ? parsed.orders : DEFAULT_AUDIO_PREFS.orders,
        waiterCalls:
          typeof parsed.waiterCalls === 'boolean'
            ? parsed.waiterCalls
            : DEFAULT_AUDIO_PREFS.waiterCalls,
        alerts: typeof parsed.alerts === 'boolean' ? parsed.alerts : DEFAULT_AUDIO_PREFS.alerts,
      };
    }
    // Migration from the pre-split single global toggle: a `false` legacy
    // value silenced everything, so honor that across all three channels.
    const legacy = localStorage.getItem(LEGACY_AUDIO_KEY);
    if (legacy !== null) {
      const enabled = legacy === 'true';
      return { orders: enabled, waiterCalls: enabled, alerts: enabled };
    }
  } catch {
    // Corrupted JSON or storage disabled — fall through to defaults.
  }
  return DEFAULT_AUDIO_PREFS;
}

/**
 * Owns the per-staff audio-preference state + its localStorage persistence
 * (load on staff change, save on prefs change, legacy single-toggle migration).
 *
 * Extracted verbatim from NotificationProvider — same effect dependency arrays,
 * same ordering, same SSR-safe lazy read. Returns the `[prefs, setPrefs]` pair
 * so the provider keeps full control over the in-memory state (the audio-play
 * paths read/write it via a ref alongside this state).
 */
export function useAudioPrefsPersistence(
  staffId: string | undefined,
): [AudioPrefs, Dispatch<SetStateAction<AudioPrefs>>] {
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);

  // Load stored prefs whenever the bound staff changes (sign-in, switch
  // user). Reading lazily inside an effect (rather than the useState
  // initializer) keeps the initial render SSR-safe and lets a logout →
  // login as a different user pull that user's saved choices.
  useEffect(() => {
    setAudioPrefs(readStoredAudioPrefs(staffId));
  }, [staffId]);

  // Save prefs whenever they change. Skip the very first run on mount —
  // the load effect above just hydrated state from storage, so writing it
  // back would be a no-op at best and an overwrite-with-defaults race at
  // worst (load effect hasn't completed before this one runs).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(audioPrefsStorageKey(staffId), JSON.stringify(audioPrefs));
    } catch {
      // Storage quota exceeded or disabled — silently drop, the in-memory
      // state still works for the session.
    }
  }, [audioPrefs, staffId]);

  return [audioPrefs, setAudioPrefs];
}
