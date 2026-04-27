import { isAppError } from '@gustri/core';
import { i18n } from '@gustri/i18n';
import * as Sentry from '@sentry/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { showSnackbarGlobal } from '@/components/providers/SnackbarProvider';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const tags: Record<string, string> = { area: 'react-error-boundary' };
    if (isAppError(error)) {
      tags.errorCode = error.code;
      tags.errorName = error.name;
    }
    Sentry.captureException(error, {
      tags,
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
    // Surface to user via global snackbar (no-op if SnackbarProvider not mounted yet).
    showSnackbarGlobal(i18n.t('common:error.message'), 'error');
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text variant="headlineSmall" style={styles.title}>
            {i18n.t('common:error.title')}
          </Text>
          <Text variant="bodyMedium" style={styles.message}>
            {i18n.t('common:error.message')}
          </Text>
          <Button mode="contained" onPress={this.handleReset} style={styles.button}>
            {i18n.t('common:error.tryAgain')}
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  title: {
    marginBottom: 8,
    fontWeight: '600',
  },
  message: {
    marginBottom: 24,
    color: '#6b7280',
    textAlign: 'center',
  },
  button: {
    borderRadius: 8,
  },
});
