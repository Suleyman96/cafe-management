import { PricingPlans } from '@/components/pricing/pricing-plans';

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

        <PricingPlans />
      </div>
    </section>
  );
}
