import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface ErrorScreenProps {
  error: Error | string;
  onRetry?: () => void;
}

export const ErrorScreen = React.memo(function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const { t } = useTranslation('common');
  const message = typeof error === 'string' ? error : error.message;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
      <Text variant="titleMedium" style={styles.title}>
        {t('somethingWentWrong')}
      </Text>
      <Text variant="bodyMedium" style={styles.message}>
        {message}
      </Text>
      {onRetry && (
        <Button mode="contained" onPress={onRetry} style={styles.button}>
          {t('tryAgain')}
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
  },
  message: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
  },
});
