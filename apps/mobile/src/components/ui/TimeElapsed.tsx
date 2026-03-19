import { differenceInMinutes, differenceInSeconds } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native-paper';

interface TimeElapsedProps {
  createdAt: string;
  showColor?: boolean;
}

function getTimeColor(minutes: number): string {
  if (minutes >= 20) return '#ef4444';
  if (minutes >= 15) return '#f97316';
  if (minutes >= 10) return '#f59e0b';
  return '#6b7280';
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

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(createdAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const color = showColor ? getTimeColor(elapsed.minutes) : '#6b7280';

  return (
    <Text variant="bodySmall" style={{ color, fontWeight: elapsed.minutes >= 10 ? '700' : '400' }}>
      {elapsed.text}
    </Text>
  );
});
