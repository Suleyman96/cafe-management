import { useTranslation } from '@gustri/i18n';
import { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

interface Props {
  message: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export function MaintenanceScreen({ message, onRetry, retrying }: Props) {
  const { t } = useTranslation('common');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>gustri</Text>
        <Text style={styles.title}>
          {t('maintenanceTitle', { defaultValue: 'Down for maintenance' })}
        </Text>
        <Text style={styles.body}>
          {message ??
            t('maintenanceBody', {
              defaultValue:
                "We're updating the system. The app will be back online shortly — thanks for your patience.",
            })}
        </Text>
        {onRetry ? (
          <Button
            mode="contained"
            onPress={onRetry}
            loading={retrying}
            disabled={retrying}
            style={styles.button}
          >
            {t('tryAgain', { defaultValue: 'Try again' })}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    color: BRAND_PRIMARY,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});
