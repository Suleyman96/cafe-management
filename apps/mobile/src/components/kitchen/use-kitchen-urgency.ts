import { getKitchenUrgencyBand, type KitchenUrgencyBand } from '@gustri/core';
import { ORDER_STATUS } from '@gustri/database';
import { differenceInMinutes } from 'date-fns';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { BRAND_PRIMARY, ORDER_STATUS_COLORS } from '@/theme';

// Urgency palette for kitchen card surfaces. Mirrors the web kitchen's
// elapsed-time bands (yellow → orange → red) but uses dark-mode hues so
// tinted cards remain readable against the kitchen screen's `#111111`
// background. `new` orders use a dark-blue tint + pulse to demand
// immediate attention; `ready` / all-items-ready use a dark-green tint
// to signal "done, awaiting waiter pickup".
const URGENCY_THEME: Record<KitchenUrgencyBand, { bg: string; border: string }> = {
  new: { bg: '#0c2654', border: '#60a5fa' },
  ready: { bg: '#0a2e1a', border: '#4ade80' },
  critical: { bg: '#3b0f0f', border: '#f87171' },
  elevated: { bg: '#3b1e00', border: '#fb923c' },
  warning: { bg: '#3f2f00', border: '#facc15' },
  // Default (cooking under 10 min) preserves the original neutral surface.
  default: { bg: '#262626', border: BRAND_PRIMARY },
};

interface UseKitchenUrgencyInput {
  status: string;
  createdAt: string;
  allItemsReady: boolean;
}

interface KitchenUrgencyResult {
  /** Card surface + border colors for the current elapsed-time band. */
  urgency: { bg: string; border: string };
  /** Animated opacity that pulses while the order is `new`. */
  pulseOpacity: Animated.Value;
}

export function useKitchenUrgency({
  status,
  createdAt,
  allItemsReady,
}: UseKitchenUrgencyInput): KitchenUrgencyResult {
  // Card surface colored by status + elapsed-time bands so the cook can
  // triage urgency at a glance — same mental model as the web kitchen.
  // Band classification lives in `@gustri/core` so this and the web
  // kitchen page stay aligned on what counts as "critical" etc.
  const minutesElapsed = differenceInMinutes(new Date(), new Date(createdAt));
  const band = getKitchenUrgencyBand({
    minutesElapsed,
    status,
    allItemsReady,
  });
  const urgency =
    band === 'default'
      ? {
          bg: URGENCY_THEME.default.bg,
          border: ORDER_STATUS_COLORS[status]?.text || URGENCY_THEME.default.border,
        }
      : URGENCY_THEME[band];

  // Pulse the whole card while `status === 'new'`. Same affordance as web's
  // `animate-pulse` on the kitchen new-order card. Uses the native driver
  // so the loop doesn't fight the JS thread during heavy realtime traffic.
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status !== ORDER_STATUS.NEW) {
      pulseOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.65, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulseOpacity]);

  return { urgency, pulseOpacity };
}
