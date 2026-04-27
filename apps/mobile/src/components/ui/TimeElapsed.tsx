import { TIME_ELAPSED_THRESHOLDS } from '@gustri/core';
import { differenceInMinutes, differenceInSeconds } from 'date-fns';
import React, { useMemo } from 'react';
import { Text } from 'react-native-paper';
import { useNow } from '@/lib/now-store';
import { COLORS } from '@/theme';

interface TimeElapsedProps {
  createdAt: string;
  showColor?: boolean;
}

function getTimeColor(minutes: number): string {
  if (minutes >= TIME_ELAPSED_THRESHOLDS.CRITICAL) return COLORS.danger;
  if (minutes >= TIME_ELAPSED_THRESHOLDS.ELEVATED) return '#f97316';
  if (minutes >= TIME_ELAPSED_THRESHOLDS.WARNING) return COLORS.warning;
  return COLORS.textMuted;
}

function formatElapsed(createdAtMs: number, nowMs: number): { text: string; minutes: number } {
  const totalMinutes = differenceInMinutes(nowMs, createdAtMs);
  const totalSeconds = differenceInSeconds(nowMs, createdAtMs);

  if (totalSeconds < 60) return { text: `${totalSeconds}s`, minutes: 0 };
  if (totalMinutes < 60) return { text: `${totalMinutes}m`, minutes: totalMinutes };
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return { text: `${hours}h ${mins}m`, minutes: totalMinutes };
}

export const TimeElapsed = React.memo(function TimeElapsed({
  createdAt,
  showColor = true,
}: TimeElapsedProps) {
  const now = useNow();
  const createdAtMs = useMemo(() => new Date(createdAt).getTime(), [createdAt]);
  const elapsed = formatElapsed(createdAtMs, now);

  const color = showColor ? getTimeColor(elapsed.minutes) : COLORS.textMuted;

  return (
    <Text
      variant="bodySmall"
      style={{
        color,
        fontWeight: elapsed.minutes >= TIME_ELAPSED_THRESHOLDS.WARNING ? '700' : '400',
      }}
    >
      {elapsed.text}
    </Text>
  );
});
