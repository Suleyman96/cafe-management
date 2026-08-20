import { Check } from 'lucide-react';
import Link from 'next/link';
import { PLANS } from '@/lib/constants';

export function Pricing() {
  return (
    <section className="py-20 sm:py-28 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Start free. Upgrade when you need more. No hidden fees.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-primary-500 text-white ring-2 ring-primary-500 shadow-xl shadow-primary-500/20 scale-[1.02]'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}
              >
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}
                >
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className={plan.highlighted ? 'text-primary-100' : 'text-gray-500'}>
                    /mo
                  </span>
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

              {/* Free is self-serve (instant signup). Paid tiers are
                  white-glove: the operator sets them up after payment, so
                  their CTA routes to Contact, not the signup flow. */}
              <Link
                href={plan.price === 0 ? '/signup?plan=free' : '/contact'}
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
          ))}
        </div>
      </div>
    </section>
  );
}
