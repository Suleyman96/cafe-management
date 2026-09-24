'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PLANS, type Plan } from '@/lib/constants';

type BillingCycle = 'monthly' | 'yearly';

/** Percent saved by paying yearly vs 12× the monthly price. */
function yearlySavingsPercent(plan: Plan): number | null {
  if (!plan.priceYearly || plan.price <= 0) return null;
  const monthlyTotal = plan.price * 12;
  return Math.round(((monthlyTotal - plan.priceYearly) / monthlyTotal) * 100);
}

/** Effective per-month cost when billed annually, rounded to a whole dollar. */
function yearlyPerMonth(plan: Plan): number | null {
  if (!plan.priceYearly) return null;
  return Math.round(plan.priceYearly / 12);
}

function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  const options: { value: BillingCycle; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];
  return (
    <div className="mt-8 flex justify-center">
      <fieldset
        className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1"
        aria-label="Billing cycle"
      >
        {options.map((option) => {
          const active = cycle === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-primary-500 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

export function PricingPlans() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const yearly = cycle === 'yearly';

  return (
    <>
      <BillingToggle cycle={cycle} onChange={setCycle} />

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isFree = plan.price === 0;
          // Show yearly figures only when the toggle is on AND the plan
          // actually has a yearly price (Free never does).
          const showYearly = yearly && !isFree && plan.priceYearly != null;
          const savings = yearlySavingsPercent(plan);
          const perMonth = yearlyPerMonth(plan);

          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-primary-500 text-white ring-2 ring-primary-500 shadow-xl shadow-primary-500/20 scale-[1.02]'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-flex self-start rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
                  Most Popular
                </span>
              )}
              <h3
                className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}
              >
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}
                >
                  {isFree ? 'Free' : `$${showYearly ? plan.priceYearly : plan.price}`}
                </span>
                {!isFree && (
                  <span className={plan.highlighted ? 'text-primary-100' : 'text-gray-500'}>
                    {showYearly ? '/yr' : '/mo'}
                  </span>
                )}
              </div>

              {/* Savings hint under the yearly price. */}
              <div className="mt-2 min-h-[1.25rem]">
                {showYearly && savings != null && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.highlighted
                          ? 'bg-white/20 text-white'
                          : 'bg-primary-50 text-primary-700'
                      }`}
                    >
                      Save ~{savings}%
                    </span>
                    {perMonth != null && (
                      <span
                        className={`text-xs ${plan.highlighted ? 'text-primary-100' : 'text-gray-500'}`}
                      >
                        ≈${perMonth}/mo billed annually
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p
                className={`mt-2 text-sm ${plan.highlighted ? 'text-primary-100' : 'text-gray-500'}`}
              >
                {plan.description}
              </p>

              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlighted ? 'text-primary-200' : 'text-primary-500'}`}
                    />
                    <span
                      className={`text-sm ${plan.highlighted ? 'text-primary-50' : 'text-gray-600'}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Free self-serves; paid tiers are white-glove (operator
                  onboards after payment) → route to Contact. */}
              <Link
                href={isFree ? '/signup?plan=free' : '/contact'}
                className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? 'bg-white text-primary-600 hover:bg-primary-50'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                {plan.cta}
              </Link>
              <p
                className={`mt-3 text-center text-xs ${
                  plan.highlighted ? 'text-primary-100' : 'text-gray-500'
                }`}
              >
                {plan.microcopy}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
