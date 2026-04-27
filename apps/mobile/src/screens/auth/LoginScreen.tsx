import { useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnackbar } from '@/hooks/use-snackbar';
import { login } from '@/lib/auth';
import { getLocalDateString } from '@/lib/date-utils';
import { Text, TextInput } from '@/lib/paper-compat';
import { db } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setStaff } = useAuthStore();
  const { showError } = useSnackbar();
  const { t } = useTranslation('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError(t('enterEmailAndPassword'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError(t('invalidEmailFormat'));
      return;
    }

    if (password.length < 6) {
      showError(t('passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const { staff } = await login({ email: email.trim(), password });
      Keyboard.dismiss();
      setStaff(staff);

      // Fire-and-forget: fill actual_start for today's schedule
      const today = getLocalDateString();
      db.schedules
        .findByStaffAndDate(staff.id, today)
        .then((schedules) => {
          const scheduled = schedules.find(
            (s: Record<string, unknown>) => s.status === 'scheduled',
          );
          if (scheduled) {
            return db.schedules.markInProgress(
              (scheduled as Record<string, unknown>).id as string,
              new Date().toISOString(),
            );
          }
        })
        .catch(() => {
          // Schedule update is non-critical, silently ignore errors
        });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('loginFailed');
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="headlineLarge" style={styles.title}>
            gustri
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('staffPortal')}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('emailAddress')}
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            disabled={loading}
            left={<TextInput.Icon icon="email" />}
          />

          <TextInput
            label={t('password')}
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            autoCapitalize="none"
            disabled={loading}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? 'eye-off' : 'eye'}
                onPress={() => setSecureEntry(!secureEntry)}
              />
            }
            onSubmitEditing={handleLogin}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {loading ? t('signingIn') : t('signIn')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontWeight: '700',
    color: '#1e293b',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
