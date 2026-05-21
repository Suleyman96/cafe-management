import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-primary-500 px-8 py-16 sm:px-16 sm:py-20 text-center">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-400/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Open Gustri before your next shift starts
            </h2>
            <p className="mt-4 text-lg text-primary-100 max-w-xl mx-auto">
              Set up in 5 minutes. Run your first orders today. Stay free until you outgrow it.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary-600 hover:bg-primary-50 transition-colors shadow-lg"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors"
              >
                See plans & pricing
              </Link>
            </div>
            <p className="mt-5 text-sm text-primary-100">
              No credit card. 5-minute setup. Free forever for ≤100 orders/mo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
