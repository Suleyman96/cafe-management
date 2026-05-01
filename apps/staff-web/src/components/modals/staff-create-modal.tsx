'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

type StaffRole = 'waiter' | 'admin' | 'kitchen' | 'owner';

interface StaffCreateModalProps {
  currentUserRole?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
}

const PHONE_REGEX = /^[+\d\s\-()]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields(
  fields: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
  },
  t: (key: string, opts?: any) => string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.fullName.trim()) {
    errors.fullName = t('staffMgmt.validationNameRequired');
  } else if (fields.fullName.length > 100) {
    errors.fullName = t('staffMgmt.validationNameTooLong');
  }

  if (!fields.email.trim()) {
    errors.email = t('staffMgmt.validationEmailRequired');
  } else if (!EMAIL_REGEX.test(fields.email)) {
    errors.email = t('staffMgmt.validationEmailInvalid');
  }

  if (!fields.password) {
    errors.password = t('staffMgmt.validationPasswordRequired');
  } else if (fields.password.length < 8) {
    errors.password = t('staffMgmt.passwordMinLength');
  } else if (!/[a-z]/.test(fields.password)) {
    errors.password = t('staffMgmt.validationPasswordLowercase');
  } else if (!/[A-Z]/.test(fields.password)) {
    errors.password = t('staffMgmt.validationPasswordUppercase');
  } else if (!/\d/.test(fields.password)) {
    errors.password = t('staffMgmt.validationPasswordNumber');
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = t('staffMgmt.validationConfirmPasswordRequired');
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = t('staffMgmt.passwordsDoNotMatch');
  }

  if (fields.phone && !PHONE_REGEX.test(fields.phone)) {
    errors.phone = t('staffMgmt.validationPhoneInvalid');
  }

  return errors;
}

export function StaffCreateModal({ currentUserRole, onClose, onSuccess }: StaffCreateModalProps) {
  const { t } = useTranslation('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateFields({ fullName, email, password, confirmPassword, phone }, t);
    setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validateFields({ fullName, email, password, confirmPassword, phone }, t);
    setFieldErrors(errors);
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      phone: true,
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/v1/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          phone: phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('staffMgmt.failedCreate'));
        return;
      }

      toast.success(t('staffMgmt.staffCreated'));
      onSuccess();
    } catch (_err) {
      setError(t('staffMgmt.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: keyof FieldErrors) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      touched[field] && fieldErrors[field]
        ? 'border-red-400 focus:ring-red-400'
        : 'border-gray-300 focus:ring-blue-500'
    }`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">{t('staffMgmt.addNewStaff')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.fullName')} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                clearFieldError('fullName');
              }}
              onBlur={() => handleBlur('fullName')}
              className={inputClass('fullName')}
              placeholder="John Doe"
            />
            {touched.fullName && fieldErrors.fullName && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email', { ns: 'common' })} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              onBlur={() => handleBlur('email')}
              className={inputClass('email')}
              placeholder="staff@example.com"
            />
            {touched.email && fieldErrors.email && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.password')} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              onBlur={() => handleBlur('password')}
              className={inputClass('password')}
              placeholder={t('staffMgmt.minEightChars')}
            />
            {touched.password && fieldErrors.password ? (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">{t('staffMgmt.passwordRequirements')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.confirmPassword')} *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError('confirmPassword');
              }}
              onBlur={() => handleBlur('confirmPassword')}
              className={inputClass('confirmPassword')}
              placeholder={t('staffMgmt.reenterPassword')}
            />
            {touched.confirmPassword && fieldErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.role')} *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="waiter">{t('waiter', { ns: 'roles' })}</option>
              <option value="kitchen">{t('staffMgmt.kitchenStaff')}</option>
              <option value="admin">{t('admin', { ns: 'roles' })}</option>
              {currentUserRole === 'owner' && (
                <option value="owner">{t('owner', { ns: 'roles' })}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('phone', { ns: 'common' })}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError('phone');
              }}
              onBlur={() => handleBlur('phone')}
              className={inputClass('phone')}
              placeholder={t('phonePlaceholder', { ns: 'common' })}
            />
            {touched.phone && fieldErrors.phone && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t('staffMgmt.creating') : t('staffMgmt.createAccount')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
