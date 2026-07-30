'use client';

import { useTranslation } from '@gustri/i18n';
import { ArrowRight, CheckCircle2, Circle, LayoutGrid, Store, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCafeSettings, useMenuItems, useTables, useUpdateCafeSettings } from '@/hooks';

const DEFAULT_CAFE_NAME = 'My Restaurant';

export default function OnboardingPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { data: settings } = useCafeSettings();
  const { data: menuItems } = useMenuItems();
  const { data: tables } = useTables();
  const updateSettings = useUpdateCafeSettings();

  // Steps complete themselves from real data — the owner does the work on the
  // existing screens, this page just tracks + links to them.
  const nameDone = !!settings?.restaurant_name && settings.restaurant_name !== DEFAULT_CAFE_NAME;
  const menuDone = (menuItems?.length ?? 0) > 0;
  const tablesDone = (tables?.length ?? 0) > 0;
  const allDone = nameDone && menuDone && tablesDone;

  const steps = [
    {
      done: nameDone,
      href: '/cafe-settings',
      icon: Store,
      title: t('onboarding.nameCafeTitle'),
      desc: t('onboarding.nameCafeDesc'),
    },
    {
      done: menuDone,
      href: '/menu',
      icon: UtensilsCrossed,
      title: t('onboarding.addMenuTitle'),
      desc: t('onboarding.addMenuDesc'),
    },
    {
      done: tablesDone,
      href: '/tables',
      icon: LayoutGrid,
      title: t('onboarding.addTablesTitle'),
      desc: t('onboarding.addTablesDesc'),
    },
  ];

  const finish = async () => {
    try {
      await updateSettings.mutateAsync({ onboarding_completed_at: new Date().toISOString() });
    } finally {
      router.push('/tables');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {t('onboarding.welcomeTitle')}
        </h1>
        <p className="mt-2 text-gray-600">{t('onboarding.welcomeSubtitle')}</p>
      </div>

      <ol className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                {step.done ? (
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-green-600" />
                ) : (
                  <Circle className="h-6 w-6 flex-shrink-0 text-gray-300" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span
                      className={`font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{step.desc}</p>
                </div>
                {!step.done && (
                  <span className="flex items-center gap-1 text-sm font-medium text-primary-600 flex-shrink-0">
                    {t('onboarding.openStep')}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={finish}
          disabled={updateSettings.isPending}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-base font-semibold text-white shadow-lg transition-all disabled:opacity-60 ${
            allDone
              ? 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/25'
              : 'bg-gray-800 hover:bg-gray-900'
          }`}
        >
          {t('onboarding.goToApp')}
          <ArrowRight className="h-4 w-4" />
        </button>
        {!allDone && (
          <button
            type="button"
            onClick={finish}
            disabled={updateSettings.isPending}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t('onboarding.doItLater')}
          </button>
        )}
      </div>
    </div>
  );
}
