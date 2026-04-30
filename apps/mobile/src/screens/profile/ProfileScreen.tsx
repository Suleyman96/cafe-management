import { LANGUAGES, useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, List } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useUpdateStaff } from '@/hooks/use-staff-management';
import { forceLogout } from '@/lib/auth';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { Text, TextInput } from '@/lib/paper-compat';
import { cleanupSounds } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { ROLE_COLORS } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const { t: tNav } = useTranslation('nav');
  const { t: tRoles } = useTranslation('roles');
  const { i18n } = useTranslation();
  const updateStaff = useUpdateStaff();

  const [loggingOut, setLoggingOut] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [languageLoading, setLanguageLoading] = useState(false);

  if (!staff) return null;

  const initials = (staff.full_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showError(t('settings.passwordsNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      showError(t('settings.passwordTooShort'));
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      showSuccess(t('settings.passwordChanged'));
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      showError(t('settings.failedChangePassword'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setLanguageLoading(true);
    try {
      await loadAndSwitchLanguage(lang);
      if (staff.id) {
        await updateStaff.mutateAsync({
          id: staff.id,
          data: { preferred_language: lang },
        });
      }
      showSuccess(t('settings.languageChanged'));
    } catch {
      showError(tCommon('error'));
    } finally {
      setLanguageLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await cleanupSounds();
      // forceLogout owns the full sequence: push-token clear, channel teardown,
      // queryClient.clear, persister cleanup, store clear, supabase signOut.
      await forceLogout('user');
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('profile.failedSignOut'));
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCancelPassword = () => {
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Avatar & Name */}
      <View style={styles.avatarSection}>
        <Avatar.Text size={80} label={initials} />
        <Text variant="headlineSmall" style={styles.name}>
          {staff.full_name}
        </Text>
        <Chip
          compact
          style={{
            backgroundColor: (ROLE_COLORS[staff.role] || { bg: '#f3f4f6' }).bg,
          }}
          textStyle={{
            color: (ROLE_COLORS[staff.role] || { text: '#374151' }).text,
            fontWeight: '600',
          }}
        >
          {tRoles(staff.role)}
        </Chip>
      </View>

      {/* Profile Information */}
      <Card style={styles.card}>
        <Card.Title
          title={t('settings.profileInformation')}
          left={(props) => <List.Icon {...props} icon="account-outline" />}
        />
        <Card.Content>
          <List.Item
            title={t('settings.email')}
            description={staff.email}
            left={(props) => <List.Icon {...props} icon="email" />}
          />
          <Divider />
          <List.Item
            title={t('settings.role')}
            description={tRoles(staff.role)}
            left={(props) => <List.Icon {...props} icon="shield-account" />}
          />
          {staff.phone && (
            <>
              <Divider />
              <List.Item
                title={tCommon('phone')}
                description={staff.phone}
                left={(props) => <List.Icon {...props} icon="phone" />}
              />
            </>
          )}
          {staff.last_login_at && (
            <>
              <Divider />
              <List.Item
                title={t('staffMgmt.lastLogin')}
                description={new Date(staff.last_login_at).toLocaleString(i18n.language)}
                left={(props) => <List.Icon {...props} icon="clock-outline" />}
              />
            </>
          )}
        </Card.Content>
      </Card>

      {/* Security / Password */}
      <Card style={styles.card}>
        <Card.Title
          title={t('settings.security')}
          left={(props) => <List.Icon {...props} icon="lock-outline" />}
        />
        <Card.Content>
          <Text variant="bodySmall" style={styles.helperText}>
            {t('settings.keepSecure')}
          </Text>

          {!isChangingPassword ? (
            <Button
              mode="outlined"
              icon="key-variant"
              onPress={() => setIsChangingPassword(true)}
              style={styles.changePasswordButton}
            >
              {t('settings.changePassword')}
            </Button>
          ) : (
            <View style={styles.passwordForm}>
              <TextInput
                label={t('settings.newPassword')}
                placeholder={t('settings.enterNewPassword')}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label={t('settings.confirmPassword')}
                placeholder={t('settings.confirmNewPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                mode="outlined"
                style={styles.input}
              />
              <View style={styles.passwordActions}>
                <Button
                  mode="outlined"
                  onPress={handleCancelPassword}
                  disabled={passwordLoading}
                  style={styles.actionButton}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleChangePassword}
                  loading={passwordLoading}
                  disabled={passwordLoading}
                  style={styles.actionButton}
                >
                  {passwordLoading ? tCommon('saving') : t('settings.updatePassword')}
                </Button>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Language Selection */}
      <Card style={styles.card}>
        <Card.Title
          title={t('settings.language')}
          left={(props) => <List.Icon {...props} icon="translate" />}
        />
        <Card.Content>
          <Text variant="bodySmall" style={styles.helperText}>
            {t('settings.selectLanguage')}
          </Text>
          <View style={styles.languageGrid}>
            {LANGUAGES.map((lang) => {
              const isSelected = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.languageButton, isSelected && styles.languageButtonSelected]}
                  onPress={() => handleLanguageChange(lang.code)}
                  disabled={languageLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text
                    style={[styles.languageName, isSelected && styles.languageNameSelected]}
                    numberOfLines={1}
                  >
                    {lang.nativeName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      {/* Sign Out */}
      <View style={styles.logoutSection}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          loading={loggingOut}
          disabled={loggingOut}
          icon="logout"
          textColor="#ef4444"
          style={styles.logoutButton}
        >
          {tNav('signOut')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  name: {
    fontWeight: '700',
    color: '#1e293b',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  helperText: {
    color: '#6b7280',
    marginBottom: 12,
  },
  changePasswordButton: {
    alignSelf: 'flex-start',
  },
  passwordForm: {
    gap: 12,
  },
  input: {
    backgroundColor: '#ffffff',
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  actionButton: {
    minWidth: 100,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  languageButtonSelected: {
    borderColor: '#367B8B',
    backgroundColor: '#ecfdf5',
  },
  languageFlag: {
    fontSize: 18,
  },
  languageName: {
    fontSize: 13,
    color: '#374151',
  },
  languageNameSelected: {
    color: '#367B8B',
    fontWeight: '600',
  },
  logoutSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  logoutButton: {
    borderColor: '#ef4444',
  },
});
