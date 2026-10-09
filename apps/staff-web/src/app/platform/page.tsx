'use client';

import { type BillingCycle, type BillingStatus, deriveBillingStatus } from '@gustri/core';
import { useDateFormatter, useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateTenantModal } from '@/components/platform/create-tenant-modal';
import { apiRoutes, type PlatformTenant } from '@/lib/api-routes';

const PLANS: PlatformTenant['plan'][] = ['free', 'standard', 'pro', 'business'];
const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly'];

// Tailwind classes for each renewal status chip. Kept inline (styling, not
// headless) — the status VALUES come from @gustri/core (deriveBillingStatus).
const BILLING_STATUS_STYLES: Record<BillingStatus, string> = {
  active: 'bg-green-100 text-green-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
};
const BILLING_STATUS_KEY: Record<BillingStatus, string> = {
  active: 'platform.billingActive',
  expiring_soon: 'platform.billingExpiringSoon',
  overdue: 'platform.billingOverdue',
};

export default function PlatformPage() {
  const { t } = useTranslation('staff');
  const dateFmt = useDateFormatter({ year: 'numeric', month: 'short', day: 'numeric' });
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  // "Renewals due" toggle — narrows the list to tenants needing attention
  // (expiring soon or overdue).
  const [renewalsDueOnly, setRenewalsDueOnly] = useState(false);

  const meQuery = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: () => apiRoutes.platform.me(),
    retry: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => apiRoutes.platform.listTenants(),
    enabled: meQuery.isSuccess,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });

  const setPlan = useMutation({
    mutationFn: ({
      id,
      plan,
      billing_cycle,
    }: {
      id: string;
      plan: PlatformTenant['plan'];
      billing_cycle?: BillingCycle;
    }) => apiRoutes.platform.setPlan(id, plan, billing_cycle ? { billing_cycle } : undefined),
    onSuccess: () => {
      toast.success(t('platform.planUpdated'));
      invalidate();
    },
    onError: () => toast.error(t('platform.actionFailed')),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRoutes.platform.setStatus(id, active),
    onSuccess: () => {
      toast.success(t('platform.statusUpdated'));
      invalidate();
    },
    onError: () => toast.error(t('platform.actionFailed')),
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Non-platform-admins are denied. The route 403s them (→ isError), but gate on
  // the positive predicate too — same authority the nav uses (useIsPlatformAdmin)
  // — so a 200 `{isPlatformAdmin:false}` would also be denied, not rendered.
  if (meQuery.isError || meQuery.data?.isPlatformAdmin !== true) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {t('platform.accessDenied')}
        </div>
      </div>
    );
  }

  const tenants = tenantsQuery.data?.tenants ?? [];
  const busy = setPlan.isPending || setStatus.isPending;

  // Renewal status is derived client-side from the paid-through date so the
  // chips stay correct as the clock advances without a refetch. Computed once
  // per render against a single "now" for consistent banner/filter/chip values.
  const now = new Date();
  const statusOf = (tn: PlatformTenant): BillingStatus | null =>
    deriveBillingStatus(tn.current_period_end, now);
  const attentionCount = tenants.filter((tn) => {
    const s = statusOf(tn);
    return s === 'expiring_soon' || s === 'overdue';
  }).length;
  const visibleTenants = renewalsDueOnly
    ? tenants.filter((tn) => {
        const s = statusOf(tn);
        return s === 'expiring_soon' || s === 'overdue';
      })
    : tenants;

  // The shareable staff login link for a cafe (/c/{slug} on this origin).
  const copyLoginLink = (slug: string) => {
    const url = `${window.location.origin}/c/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('platform.linkCopied')),
      () => toast.error(t('platform.actionFailed')),
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('platform.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('platform.subtitle')} · {tenants.length}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('platformCreate.newTenant')}
        </Button>
      </div>

      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })}
        />
      )}

      {/* Primary in-console reminder: paid tenants expiring soon or overdue.
          The scheduled email job is the backup; this banner is what the
          operator reliably sees. */}
      {attentionCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-medium">
            {t('platform.renewalsBanner', { count: attentionCount })}
          </span>
          {!renewalsDueOnly && (
            <Button size="sm" variant="outline" onClick={() => setRenewalsDueOnly(true)}>
              {t('platform.renewalsShowOnly')}
            </Button>
          )}
        </div>
      )}

      {tenants.length > 0 && (
        <div className="mb-3 flex items-center">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={renewalsDueOnly}
              onChange={(e) => setRenewalsDueOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t('platform.renewalsDueFilter')}
          </label>
        </div>
      )}

      {tenantsQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : tenantsQuery.isError ? (
        // A failed fetch must NOT masquerade as "no tenants" — that could read as
        // an empty platform. Show an explicit error with a retry.
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{t('platform.loadFailed')}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => tenantsQuery.refetch()}
          >
            {t('platform.retry')}
          </Button>
        </div>
      ) : tenants.length === 0 ? (
        <p className="text-gray-500">{t('platform.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('platform.tenant')}</th>
                <th className="px-4 py-3">{t('platform.plan')}</th>
                <th className="px-4 py-3">{t('platform.billing')}</th>
                <th className="px-4 py-3">{t('platform.status')}</th>
                <th className="px-4 py-3">{t('platform.activity')}</th>
                <th className="px-4 py-3">{t('platform.loginLink')}</th>
                <th className="px-4 py-3">{t('platform.created')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleTenants.map((tn) => {
                const billingStatus = statusOf(tn);
                const isPaid = tn.plan !== 'free';
                return (
                  <tr key={tn.id} className={tn.is_active ? '' : 'bg-red-50/40'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{tn.name}</div>
                      <div className="text-xs text-gray-500">{tn.billing_email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <select
                          value={tn.plan}
                          disabled={busy}
                          onChange={(e) =>
                            setPlan.mutate({
                              id: tn.id,
                              plan: e.target.value as PlatformTenant['plan'],
                            })
                          }
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p}>
                              {t(`platform.plan_${p}`)}
                            </option>
                          ))}
                        </select>
                        {/* Cadence is only meaningful on a paid plan. Changing it
                          recomputes the paid-through date server-side. */}
                        {isPaid && (
                          <select
                            aria-label={t('platform.billingCycle')}
                            value={tn.billing_cycle ?? 'monthly'}
                            disabled={busy}
                            onChange={(e) =>
                              setPlan.mutate({
                                id: tn.id,
                                plan: tn.plan,
                                billing_cycle: e.target.value as BillingCycle,
                              })
                            }
                            className="block rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            {BILLING_CYCLES.map((c) => (
                              <option key={c} value={c}>
                                {t(`platform.cycle_${c}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isPaid && tn.current_period_end ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            {t('platform.paidThrough', {
                              date: dateFmt.format(new Date(tn.current_period_end)),
                            })}
                          </div>
                          {billingStatus && (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BILLING_STATUS_STYLES[billingStatus]}`}
                            >
                              {t(BILLING_STATUS_KEY[billingStatus])}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          tn.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tn.is_active ? t('platform.active') : t('platform.suspended')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t('platform.activityCounts', {
                        staff: tn.staff_count,
                        tables: tn.table_count,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => copyLoginLink(tn.slug)}
                        title={`/c/${tn.slug}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 font-mono text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="max-w-[10rem] truncate">/c/{tn.slug}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {tn.created_at ? tn.created_at.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (tn.is_active && !window.confirm(t('platform.confirmSuspend'))) return;
                          setStatus.mutate({ id: tn.id, active: !tn.is_active });
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                          tn.is_active
                            ? 'border border-red-300 text-red-700 hover:bg-red-50'
                            : 'border border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {tn.is_active ? t('platform.suspend') : t('platform.activate')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleTenants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    {t('platform.renewalsNone')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
