'use client';

import type { UserRole } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, getRoleBadgeColor, LoadingSpinner } from '@gustri/ui-web';
import { Edit2, Plus, Search, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { StaffCreateModal } from '@/components/modals/staff-create-modal';
import { StaffEditModal } from '@/components/modals/staff-edit-modal';
import { useStaff } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { USER_ROLE_ICONS } from '@/lib/enum-icons';
import type { Staff } from '@/types';

export default function StaffPage() {
  const { t } = useTranslation('staff');
  const { t: tRoles } = useTranslation('roles');
  const { staff: currentUser } = useAuth();
  const { data: staffList, isLoading, refetch } = useStaff();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Only admins can access this page
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'owner') {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          {t('staffMgmt.accessDenied')}
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    const Icon = USER_ROLE_ICONS[role as UserRole];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  // Filter staff
  const filteredStaff = staffList?.filter((staff) => {
    const matchesSearch =
      staff.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || staff.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{t('staffMgmt.title')}</h1>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="text-xs sm:text-sm w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('staffMgmt.addStaff')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('staffMgmt.searchStaff')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="all">{t('staffMgmt.allRoles')}</option>
          <option value="owner">{tRoles('owner')}</option>
          <option value="admin">{tRoles('admin')}</option>
          <option value="waiter">{tRoles('waiter')}</option>
          <option value="kitchen">{tRoles('kitchen')}</option>
        </select>
      </div>

      {/* Staff List - Desktop Table */}
      <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('staffMgmt.staffMember')}
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('staffMgmt.role')}
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('status', { ns: 'common' })}
              </th>
              <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('actions', { ns: 'common' })}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStaff?.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {getRoleIcon(staff.role)}
                    </div>
                    <div className="ml-2 sm:ml-4 min-w-0">
                      <Link
                        href={`/staff/${staff.id}`}
                        className="text-xs sm:text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                      >
                        {staff.full_name}
                        {staff.id === currentUser?.id && (
                          <span className="ml-1 sm:ml-2 text-xs text-gray-500">
                            {t('staffMgmt.you')}
                          </span>
                        )}
                      </Link>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">{staff.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(
                      staff.role,
                    )}`}
                  >
                    {getRoleIcon(staff.role)}
                    <span className="hidden lg:inline">{tRoles(staff.role)}</span>
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                  {staff.is_active ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs sm:text-sm">
                      <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden lg:inline">{t('active', { ns: 'common' })}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                      <UserX className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden lg:inline">{t('inactive', { ns: 'common' })}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStaff(staff);
                      setIsEditModalOpen(true);
                    }}
                    className="text-xs"
                  >
                    <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                    <span className="hidden sm:inline">{t('edit', { ns: 'common' })}</span>
                  </Button>
                </td>
              </tr>
            ))}
            {filteredStaff?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  {t('staffMgmt.noStaff')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Staff List - Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filteredStaff?.map((staff) => (
          <div key={staff.id} className="bg-white rounded-lg shadow p-3 border">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {getRoleIcon(staff.role)}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/staff/${staff.id}`}
                    className="font-medium text-sm truncate block hover:text-blue-600"
                  >
                    {staff.full_name}
                    {staff.id === currentUser?.id && (
                      <span className="ml-1 text-xs text-gray-500">{t('staffMgmt.you')}</span>
                    )}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">{staff.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStaff(staff);
                  setIsEditModalOpen(true);
                }}
                className="text-xs ml-2"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(staff.role)}`}
              >
                {getRoleIcon(staff.role)}
                {tRoles(staff.role)}
              </span>
              {staff.is_active ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                  <UserCheck className="h-3 w-3" />
                  {t('active', { ns: 'common' })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                  <UserX className="h-3 w-3" />
                  {t('inactive', { ns: 'common' })}
                </span>
              )}
            </div>
          </div>
        ))}
        {filteredStaff?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-500">
            {t('staffMgmt.noStaff')}
          </div>
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <StaffCreateModal
          currentUserRole={currentUser?.role}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refetch();
          }}
        />
      )}

      {isEditModalOpen && selectedStaff && (
        <StaffEditModal
          staff={selectedStaff}
          currentUserRole={currentUser?.role}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedStaff(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
