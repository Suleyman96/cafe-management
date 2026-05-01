import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Gustri collects, stores, and protects personal data on behalf of restaurants and their customers.',
};

const LAST_UPDATED = 'May 1, 2026';
const CONTACT_EMAIL = 'privacy@gustri.com';

export default function PrivacyPage() {
  return (
    <section className="pt-32 pb-20 sm:pt-40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="mt-12 prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed">
            Gustri is a B2B SaaS platform used by restaurants to manage their operations. This
            policy explains what personal data Gustri processes on behalf of those restaurants, how
            that data is stored, and the rights you have over it. Where Gustri acts as a data
            processor (most customer-facing data), the restaurant you ordered from is the data
            controller — your primary point of contact for privacy requests is that restaurant.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">1. Data we collect</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Staff accounts</h3>
          <p className="text-gray-600 leading-relaxed">
            When a restaurant adds a staff member (waiter, kitchen, admin, owner), we store the
            staff member&apos;s email address, full name, role, and optional phone number. We use
            this data to authenticate the staff member and assign them to a tenant.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Customer orders</h3>
          <p className="text-gray-600 leading-relaxed">
            When a customer places an order — directly through a QR-code menu or via a waiter — we
            store the order contents (items, quantities, modifiers), the table or order type, and
            any free-text customer notes. For delivery orders we additionally store the
            customer&apos;s name, phone number, and delivery address. Walk-in and dine-in orders are
            stored without customer-identifying fields unless the customer chooses to provide them.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Payment records</h3>
          <p className="text-gray-600 leading-relaxed">
            We record the payment <em>method</em> used for each order (cash, card, or digital) and
            the amount, but we do not store card numbers, CVCs, or any other primary payment
            credentials. Card payments are processed by the restaurant&apos;s payment terminal or
            payment processor, not by Gustri.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">2. How we protect your data</h2>
          <p className="text-gray-600 leading-relaxed">
            Customer-identifying fields (name, phone number, delivery address, free-text notes
            attached to orders, customer-feedback messages) are encrypted at rest using
            PostgreSQL&apos;s pgcrypto extension. Encryption keys are stored in the database
            configuration and are not accessible to staff users through the application.
            Application-level access is gated by row-level security policies that scope every query
            to the staff member&apos;s tenant.
          </p>
          <p className="text-gray-600 leading-relaxed">
            All data in transit is protected by TLS. Backups are encrypted at rest and retained by
            our database provider on a rolling 7-day window for point-in-time recovery.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">3. Retention</h2>
          <p className="text-gray-600 leading-relaxed">
            Gustri commits to the following retention defaults:
          </p>
          <ul className="text-gray-600 leading-relaxed">
            <li>
              <strong>Orders</strong> are archived 24 months after closure. Archived orders remain
              available for the restaurant&apos;s financial reporting in aggregate form.
            </li>
            <li>
              <strong>Customer-identifying fields</strong> attached to archived orders (name, phone,
              address, notes) are anonymized 12 months after the order closes — replaced with a
              non-reversible hash so aggregate analytics are unaffected.
            </li>
            <li>
              <strong>Staff accounts</strong> are retained while the staff member is active.
              Deactivated accounts retain their email and full name (for audit-log attribution) but
              are excluded from authentication.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">4. Your rights</h2>
          <p className="text-gray-600 leading-relaxed">
            Under the EU General Data Protection Regulation (GDPR) and the Turkish Personal Data
            Protection Law (KVKK), you have the right to:
          </p>
          <ul className="text-gray-600 leading-relaxed">
            <li>Access the personal data we hold about you;</li>
            <li>Request correction of inaccurate data;</li>
            <li>Request deletion of your data, subject to retention obligations;</li>
            <li>Withdraw consent where processing is based on consent;</li>
            <li>Lodge a complaint with your local data-protection authority.</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            Because Gustri is a processor for most customer-facing data, the practical procedure
            today is to contact the cafe or restaurant where the data was collected (the
            controller). The restaurant&apos;s admin can locate, correct, or delete the relevant
            records on your behalf and we will assist them. For data Gustri controls directly (staff
            accounts, billing records), email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">5. Sub-processors</h2>
          <p className="text-gray-600 leading-relaxed">
            Gustri uses the following third-party services to operate the platform:
          </p>
          <ul className="text-gray-600 leading-relaxed">
            <li>Supabase / AWS — database, authentication, file storage (EU region).</li>
            <li>Vercel — web application hosting.</li>
            <li>Sentry — error monitoring (PII redacted before transmission).</li>
            <li>Expo — mobile push-notification delivery.</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            We do not sell personal data to advertisers and do not run advertising analytics on
            customer data.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">6. Changes to this policy</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this policy as the platform evolves. Material changes will be announced
            through the staff dashboard at least 14 days before they take effect. The &ldquo;Last
            updated&rdquo; date at the top reflects the most recent revision.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Questions about this policy or about your data:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
