import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FAQ } from '@/components/home/faq';
import { PLANS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for Gustri. Start free with POS, QR ordering, and more. Upgrade as you grow.',
};

export default function PricingPage() {
  return (
    <>
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
              Simple, transparent pricing
            </h1>
            <p className="mt-6 text-lg text-gray-600">
              Start free. No credit card required. Upgrade when you need more.
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

                <Link
                  href={
                    plan.name === 'Business'
                      ? '/contact'
                      : `/signup?plan=${plan.name.toLowerCase()}`
                  }
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

          {/* Comparison note */}
          <p className="mt-12 text-center text-sm text-gray-500">
            All plans include POS, QR ordering, and kitchen display. Prices in USD, billed monthly.
          </p>
        </div>
      </section>

      <FAQ />
    </>
  );
}
