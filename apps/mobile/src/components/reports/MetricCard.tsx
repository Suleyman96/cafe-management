import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export const MetricCard = React.memo(function MetricCard({
  label,
  value,
  subtitle,
  color,
}: MetricCardProps) {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <Text variant="bodySmall" style={styles.label}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={[styles.value, color ? { color } : undefined]}>
          {value}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '45%' },
  content: { alignItems: 'center', gap: 2 },
  label: { color: '#6b7280', textAlign: 'center' },
  value: { fontWeight: '700', color: '#1e293b' },
  subtitle: { color: '#9ca3af', textAlign: 'center', fontSize: 11 },
});
