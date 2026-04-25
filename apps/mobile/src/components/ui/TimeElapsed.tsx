import { differenceInMinutes, differenceInSeconds } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native-paper';
import { COLORS } from '@/theme';

interface TimeElapsedProps {
  createdAt: string;
  showColor?: boolean;
}

function getTimeColor(minutes: number): string {
  if (minutes >= 20) return COLORS.danger;
  if (minutes >= 15) return '#f97316';
  if (minutes >= 10) return COLORS.warning;
  return COLORS.textMuted;
}

function formatElapsed(createdAt: string): { text: string; minutes: number } {
  const now = new Date();
  const created = new Date(createdAt);
  const totalMinutes = differenceInMinutes(now, created);
  const totalSeconds = differenceInSeconds(now, created);

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
  const [elapsed, setElapsed] = useState(() => formatElapsed(createdAt));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const result = formatElapsed(createdAt);
      setElapsed(result);

      // Switch to 60s interval once past the first minute
      if (result.minutes >= 1 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          setElapsed(formatElapsed(createdAt));
        }, 60000);
      }
    };

    const initial = formatElapsed(createdAt);
    const initialInterval = initial.minutes >= 1 ? 60000 : 1000;
    intervalRef.current = setInterval(tick, initialInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [createdAt]);

  const color = showColor ? getTimeColor(elapsed.minutes) : COLORS.textMuted;

  return (
    <Text variant="bodySmall" style={{ color, fontWeight: elapsed.minutes >= 10 ? '700' : '400' }}>
      {elapsed.text}
    </Text>
  );
});
