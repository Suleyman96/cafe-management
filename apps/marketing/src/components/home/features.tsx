import {
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
import { FEATURES } from '@/lib/constants';

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

export function Features() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Everything you need to run your restaurant
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Built-in features that other platforms charge extra for. No add-ons, no hidden fees.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-gray-100 bg-white p-6 hover:border-primary-100 hover:shadow-lg hover:shadow-primary-50 transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  {Icon && <Icon className="h-5 w-5 text-primary-600" />}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
