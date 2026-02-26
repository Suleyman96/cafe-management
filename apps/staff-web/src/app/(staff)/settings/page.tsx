'use client';

import { LANGUAGES, useTranslation } from '@cafe-idare/i18n';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { Eye, EyeOff, Globe, Key, Mail, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { staff, isLoading } = useAuth();
  const { t, i18n } = useTranslation('staff');

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [_currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [_showCurrentPassword, _setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [languageLoading, setLanguageLoading] = useState(false);

  const handleChangeLanguage = async (lang: string) => {
    setLanguageLoading(true);
    try {
      await loadAndSwitchLanguage(lang);
      toast.success(t('settings.languageChanged'));
    } catch {
      toast.error(t('error', { ns: 'common' }));
    } finally {
      setLanguageLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordsNotMatch'));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success(t('settings.passwordChanged'));
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || t('settings.failedChangePassword'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string | null | undefined) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'waiter':
        return 'bg-blue-100 text-blue-800';
      case 'kitchen':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t('settings.unableLoadInfo')}</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('settings.title')}</h1>

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t('settings.profileInformation')}
        </h2>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">{t('settings.fullName')}</p>
              <p className="font-medium text-sm sm:text-base truncate">{staff.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">{t('settings.email')}</p>
              <p className="font-medium text-sm sm:text-base truncate">{staff.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">{t('settings.role')}</p>
              <span
                className={`inline-block px-2 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full capitalize ${getRoleBadgeColor(staff.role)}`}
              >
                {staff.role || 'Staff'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          <h2 className="text-base sm:text-lg font-semibold">{t('settings.language')}</h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mb-3">{t('settings.selectLanguage')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChangeLanguage(lang.code)}
              disabled={languageLoading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${languageLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="truncate">{lang.nativeName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold">{t('settings.security')}</h2>
          {!isChangingPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingPassword(true)}
              className="text-xs sm:text-sm w-full sm:w-auto"
            >
              <Key className="h-4 w-4 mr-2" />
              {t('settings.changePassword')}
            </Button>
          )}
        </div>

        {isChangingPassword ? (
          <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('settings.newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder={t('settings.enterNewPassword')}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('settings.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder={t('settings.confirmNewPassword')}
                required
                minLength={6}
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={passwordLoading}
                size="sm"
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                {t('cancel', { ns: 'common' })}
              </Button>
              <Button
                type="submit"
                disabled={passwordLoading}
                size="sm"
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                {passwordLoading ? t('saving', { ns: 'common' }) : t('settings.updatePassword')}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs sm:text-sm text-gray-500">{t('settings.keepSecure')}</p>
        )}
      </div>
    </div>
  );
}
