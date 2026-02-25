'use client';

import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { ChefHat, Edit2, Plus, Search, Shield, User, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { StaffCreateModal } from '@/components/modals/staff-create-modal';
import { StaffEditModal } from '@/components/modals/staff-edit-modal';
import { useStaff } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';

export default function StaffPage() {
  const { staff: currentUser } = useAuth();
  const { data: staffList, isLoading, refetch } = useStaff();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  // Only admins can access this page
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'owner') {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          Access denied. Only administrators can manage staff.
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'kitchen':
        return <ChefHat className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-emerald-100 text-emerald-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'kitchen':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Filter staff
  const filteredStaff = staffList?.filter((staff: any) => {
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
        <h1 className="text-xl sm:text-2xl font-bold">Staff Management</h1>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="text-xs sm:text-sm w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
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
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="waiter">Waiter</option>
          <option value="kitchen">Kitchen</option>
        </select>
      </div>

      {/* Staff List - Desktop Table */}
      <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Staff Member
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStaff?.map((staff: any) => (
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
                          <span className="ml-1 sm:ml-2 text-xs text-gray-500">(You)</span>
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
                    <span className="hidden lg:inline">{staff.role}</span>
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                  {staff.is_active ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs sm:text-sm">
                      <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden lg:inline">Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                      <UserX className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden lg:inline">Inactive</span>
                    </span>
                  )}
                </td>
                <td className="hidden md:table-cell px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {staff.phone || '-'}
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
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </td>
              </tr>
            ))}
            {filteredStaff?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No staff members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Staff List - Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {filteredStaff?.map((staff: any) => (
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
                      <span className="ml-1 text-xs text-gray-500">(You)</span>
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
                {staff.role}
              </span>
              {staff.is_active ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                  <UserCheck className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                  <UserX className="h-3 w-3" />
                  Inactive
                </span>
              )}
            </div>
          </div>
        ))}
        {filteredStaff?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-500">
            No staff members found
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
