import { useTranslation } from '@gustri/i18n';
import { useEffect } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

const IOS_STORE_URL = 'itms-apps://itunes.apple.com/app/id0';
const ANDROID_STORE_URL = 'market://details?id=com.gustri.app';

interface Props {
  latest: string;
}

export function ForceUpdateScreen({ latest }: Props) {
  const { t } = useTranslation('common');

  // Block Android hardware back so the user can't dismiss the gate.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleOpenStore = () => {
    const url = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    Linking.openURL(url).catch(() => {
      // Fallback to https if the deeplink scheme isn't available
      const fallback =
        Platform.OS === 'ios'
          ? 'https://apps.apple.com/app/id0'
          : 'https://play.google.com/store/apps/details?id=com.gustri.app';
      Linking.openURL(fallback).catch(() => {});
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>gustri</Text>
        <Text style={styles.title}>
          {t('forceUpdateTitle', { defaultValue: 'Update required' })}
        </Text>
        <Text style={styles.body}>
          {t('forceUpdateBody', {
            defaultValue:
              'A newer version of the app is required to continue. Please update to keep using gustri.',
            latest,
          })}
        </Text>
        <Text style={styles.meta}>
          {t('forceUpdateLatest', { defaultValue: 'Latest version: {{latest}}', latest })}
        </Text>
        <Button mode="contained" onPress={handleOpenStore} style={styles.button}>
          {t('openStore', { defaultValue: 'Open App Store' })}
        </Button>
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
  meta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});
