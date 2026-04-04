import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Gustri is an all-in-one restaurant management platform built to simplify operations for cafes and restaurants of all sizes.',
};

const values = [
  {
    title: 'Simplicity first',
    description:
      "Restaurant software shouldn't require a manual. We design every feature to be intuitive from day one.",
  },
  {
    title: 'Fair pricing',
    description:
      'A generous free tier and transparent plans. No hidden fees, no per-transaction charges, no lock-in.',
  },
  {
    title: 'Built for real restaurants',
    description:
      'Every feature comes from real feedback and real problems. We build what restaurants actually need.',
  },
  {
    title: 'Global by default',
    description:
      '20 languages supported. Multi-currency ready. Built for restaurants everywhere, not just one market.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-center">
            About Gustri
          </h1>
          <p className="mt-6 text-lg text-gray-600 text-center max-w-2xl mx-auto">
            We&apos;re building the restaurant management platform we wish existed — simple,
            affordable, and complete.
          </p>

          <div className="mt-16 prose prose-gray max-w-none">
            <h2 className="text-2xl font-bold text-gray-900">Why we built Gustri</h2>
            <p className="text-gray-600 leading-relaxed">
              Running a restaurant is hard enough without fighting your software. Most restaurant
              management systems are either too expensive, too complex, or force you to piece
              together multiple tools that don&apos;t talk to each other.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Gustri brings POS, QR ordering, kitchen display, delivery management, inventory, staff
              scheduling, and analytics into one platform. Start with the free plan and only pay
              more when you need more.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center">What we believe</h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {values.map((value) => (
              <div key={value.title} className="rounded-2xl bg-white p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{value.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Want to learn more?</h2>
          <p className="mt-4 text-gray-600">
            See how Gustri can help your restaurant, or reach out with any questions.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-primary-600 transition-colors"
            >
              Explore Features
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
