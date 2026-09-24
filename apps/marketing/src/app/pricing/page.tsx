import type { Metadata } from 'next';
import { FAQ } from '@/components/home/faq';
import { PricingPlans } from '@/components/pricing/pricing-plans';

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

          <PricingPlans />

          {/* Comparison note */}
          <p className="mt-12 text-center text-sm text-gray-500">
            All plans include POS, QR ordering, and kitchen display. Prices in USD.
          </p>
        </div>
      </section>

      <FAQ />
    </>
  );
}
