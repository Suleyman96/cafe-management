import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  CreditCard,
  LayoutGrid,
  ListTodo,
  MessageSquare,
  Monitor,
  Package,
  QrCode,
  Receipt,
  Trash2,
  Truck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FEATURES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore all Gustri features: POS, QR ordering, kitchen display, delivery, inventory, staff scheduling, and more.',
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor,
  QrCode,
  ChefHat,
  Truck,
  LayoutGrid,
  CreditCard,
  Package,
  Receipt,
  Trash2,
  CalendarDays,
  ListTodo,
  MessageSquare,
};

const categories = [
  {
    key: 'operations',
    label: 'Operations',
    description: 'Streamline day-to-day restaurant operations',
  },
  {
    key: 'finance',
    label: 'Finance & Inventory',
    description: 'Track costs, stock, and reduce waste',
  },
  { key: 'staff', label: 'Staff Management', description: 'Schedule shifts and manage tasks' },
  {
    key: 'customer',
    label: 'Customer Experience',
    description: 'Collect feedback and build loyalty',
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
            Everything you need, <span className="text-primary-500">nothing you don&apos;t</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Built-in features that other platforms charge extra for. No add-ons, no plugins, no
            hidden fees.
          </p>
        </div>
      </section>

      {categories.map((category) => {
        const items = FEATURES.filter((f) => f.category === category.key);
        if (items.length === 0) return null;

        return (
          <section key={category.key} className="py-16 even:bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900">{category.label}</h2>
                <p className="mt-2 text-gray-600">{category.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((feature) => {
                  const Icon = iconMap[feature.icon];
                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-gray-100 bg-white p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        {Icon && <Icon className="h-5 w-5 text-primary-600" />}
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <section className="py-20 bg-primary-500">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to simplify your restaurant?</h2>
          <p className="mt-4 text-primary-100">
            Start with the free plan. No credit card, no commitment.
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
          >
            View Pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
