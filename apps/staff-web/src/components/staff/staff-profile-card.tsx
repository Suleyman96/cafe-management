'use client';

import type { UserRole } from '@gustri/database/schemas';
import type { Staff } from '@gustri/database/types';
import { useDateFormatter, useTranslation } from '@gustri/i18n';
import { Button, getRoleBadgeColor } from '@gustri/ui-web';
import { Calendar, Clock, Edit2, Key, Mail, Phone, UserCheck, UserX } from 'lucide-react';
import { USER_ROLE_ICONS } from '@/lib/enum-icons';

interface StaffProfileCardProps {
  member: Staff;
  onEdit: () => void;
  onResetPassword: () => void;
}

function getRoleIcon(role: string) {
  const Icon = USER_ROLE_ICONS[role as UserRole];
  return Icon ? <Icon className="h-5 w-5" /> : null;
}

export function StaffProfileCard({ member, onEdit, onResetPassword }: StaffProfileCardProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const dfDate = useDateFormatter();
  const dfDateTime = useDateFormatter({
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            {getRoleIcon(member.role)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{member.full_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(member.role)}`}
              >
                {getRoleIcon(member.role)}
                {member.role}
              </span>
              {member.is_active ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                  <UserCheck className="h-3 w-3" />
                  {tCommon('active')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                  <UserX className="h-3 w-3" />
                  {tCommon('inactive')}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                {member.email}
              </div>
              {member.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                {t('staffMgmt.memberSince', {
                  date: dfDate.format(new Date(member.created_at)),
                })}
              </div>
              {member.last_login_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  {t('staffMgmt.lastLoginAt', {
                    date: dfDateTime.format(new Date(member.last_login_at)),
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            {tCommon('edit')}
          </Button>
          <Button variant="outline" size="sm" onClick={onResetPassword} className="text-xs">
            <Key className="h-3.5 w-3.5 mr-1" />
            {t('staffMgmt.resetPassword')}
          </Button>
        </div>
      </div>
    </div>
  );
}
