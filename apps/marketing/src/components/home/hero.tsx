import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { FREE_PLAN_REASSURANCE } from '@/lib/constants';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background: a deliberate teal glow over white (the old /50 wash read
          as flat gray). Soft, brand-forward, still lets the text breathe. */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white to-white" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[560px] w-[900px] rounded-full bg-primary-200/40 blur-[130px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Free for your first 300 orders/month — no credit card
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 text-balance max-w-4xl mx-auto">
          Run your cafe from your phone —{' '}
          <span className="text-primary-500">without paying for software built for chains.</span>
        </h1>

        {/* Subheading */}
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto text-balance leading-relaxed">
          The affordable, modern platform for small cafes, coffee shops, and bakeries. POS, QR
          ordering, kitchen tickets, and inventory — free for your first 300 orders/month. No card
          processor lock-in. Setup in 5 minutes.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 transition-all hover:shadow-primary-500/40"
          >
            Start Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/features"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            See All Features
          </Link>
        </div>

        {/* CTA reassurance */}
        <p className="mt-4 text-sm text-gray-500">{FREE_PLAN_REASSURANCE}</p>

        {/* Social proof */}
        <p className="mt-10 text-sm text-gray-500">
          Works on any tablet you already own. 20 languages supported. No setup fees.
        </p>
      </div>
    </section>
  );
}
