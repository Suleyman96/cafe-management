import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

/**
 * Landing screen for notification taps whose payload references an
 * order/table/call that doesn't belong to the current tenant — typically a
 * stale push from a prior session, or a spoofed payload. The notification
 * deep-link flow checks tenant ownership before navigating; foreign-tenant
 * targets land here so the user gets a sensible message instead of a
 * blank detail screen waiting on an RLS-blocked fetch.
 */
export default function NotificationExpiredScreen() {
  const { t } = useTranslation('common');
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>gustri</Text>
        <Text style={styles.title}>{t('notification.expired.title')}</Text>
        <Text style={styles.body}>{t('notification.expired.body')}</Text>
        <Button
          mode="contained"
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={styles.button}
        >
          {t('back', { defaultValue: 'Back' })}
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
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});
