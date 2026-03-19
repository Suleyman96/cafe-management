import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState = React.memo(function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={64} color="#9ca3af" />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {description && (
        <Text variant="bodyMedium" style={styles.description}>
          {description}
        </Text>
      )}
      {action && (
        <Button mode="contained" onPress={action.onPress} style={styles.button}>
          {action.label}
        </Button>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    marginTop: 16,
    color: '#374151',
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
  },
});
