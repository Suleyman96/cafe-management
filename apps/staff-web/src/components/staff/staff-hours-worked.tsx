'use client';

import { useTranslation } from '@gustri/i18n';
import { Calendar, Clock } from 'lucide-react';

interface StaffHoursWorkedProps {
  weeklyHours: number;
  monthlyHours: number;
}

export function StaffHoursWorked({ weeklyHours, monthlyHours }: StaffHoursWorkedProps) {
  const { t: tCommon } = useTranslation('common');

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-blue-600 mb-1">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">{tCommon('thisWeek')}</span>
        </div>
        <p className="text-2xl font-bold">{weeklyHours}h</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-green-600 mb-1">
          <Calendar className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">
            {tCommon('thisMonth')}
          </span>
        </div>
        <p className="text-2xl font-bold">{monthlyHours}h</p>
      </div>
    </div>
  );
}
