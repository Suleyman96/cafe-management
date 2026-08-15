import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing access to and use of the Gustri restaurant management platform.',
};

const LAST_UPDATED = 'May 1, 2026';
const CONTACT_EMAIL = 'support@gustri.com';

export default function TermsPage() {
  return (
    <section className="pt-32 pb-20 sm:pt-40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="mt-12 prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed">
            These terms govern your use of Gustri, a B2B SaaS platform that helps restaurants and
            cafes manage orders, tables, menus, staff, and operations. By signing up for or
            otherwise using Gustri, the entity creating the account (&ldquo;you&rdquo;, &ldquo;the
            restaurant&rdquo;) agrees to these terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">1. The service</h2>
          <p className="text-gray-600 leading-relaxed">
            Gustri provides a web and mobile application for restaurant operations: order
            management, kitchen display, table tracking, QR-code customer ordering, staff
            scheduling, inventory, and reporting. The exact feature set available to your account
            depends on the plan you select. Gustri is sold as a subscription; the current plans and
            prices are listed on our pricing page and may be revised on 30 days&apos; notice.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">2. Your account</h2>
          <p className="text-gray-600 leading-relaxed">
            You must provide accurate registration information and keep it current. You are
            responsible for the security of your account credentials and for all activity that
            occurs under your account. You will not share staff credentials with people who are not
            employed or contracted by your restaurant. If you discover unauthorized access, notify
            us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            promptly.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">3. Your responsibilities</h2>
          <p className="text-gray-600 leading-relaxed">
            You agree that, in your use of Gustri, you will:
          </p>
          <ul className="text-gray-600 leading-relaxed">
            <li>Comply with all laws applicable to your business and your jurisdiction;</li>
            <li>
              Obtain any consent required from your customers before storing their personal data
              (name, phone, delivery address) on the platform;
            </li>
            <li>Not use Gustri to process unlawful, fraudulent, or harmful content;</li>
            <li>
              Not attempt to reverse-engineer, decompile, or scrape the service beyond the
              functionality exposed by our public APIs;
            </li>
            <li>
              Not use Gustri to compete with us by reselling the service or offering it as your own.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">4. Data ownership</h2>
          <p className="text-gray-600 leading-relaxed">
            You retain all rights to the data you upload to or generate within Gustri (menu items,
            orders, customer records, settings). Gustri processes that data on your behalf as a data
            processor; for the relationship between Gustri, you, and your customers, see our{' '}
            <a href="/privacy" className="text-primary-600 hover:underline">
              Privacy Policy
            </a>
            . You can export your data at any time through the staff dashboard.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">
            5. Subscription &amp; cancellation
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Paid plans are arranged directly with us and billed by invoice (for example, by bank
            transfer). Your plan is activated once payment is received and renews for the period you
            agree with us. To change or cancel a paid plan, contact us; cancellation takes effect at
            the end of the current paid period and we do not refund partial periods. The free plan
            requires no payment and remains free as long as you fit within its usage caps.
          </p>
          <p className="text-gray-600 leading-relaxed">
            We may suspend or terminate accounts for non-payment, misuse, or breach of these terms.
            On termination, you have 30 days to export your data; after that, data is deleted in
            accordance with our retention schedule.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">6. Service availability</h2>
          <p className="text-gray-600 leading-relaxed">
            We aim for high availability and operate redundant infrastructure, but we do not
            guarantee uninterrupted service. Scheduled maintenance is announced through the staff
            dashboard. The service is provided &ldquo;as is&rdquo; — we make no warranties of
            fitness for a particular purpose beyond what local consumer-protection law makes
            non-waivable.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">7. Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            To the maximum extent permitted by law, Gustri&apos;s total liability for any claim
            arising from these terms or your use of the service is limited to the fees you paid us
            in the 12 months preceding the claim. Gustri is not liable for indirect, consequential,
            or punitive damages — including lost revenue, lost data not attributable to a
            Gustri-side defect, or business interruption — even if we were advised of the
            possibility. Nothing in this section limits liability that cannot be limited under
            applicable law (e.g., for fraud or willful misconduct).
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">8. Changes to these terms</h2>
          <p className="text-gray-600 leading-relaxed">
            We may revise these terms over time. Material changes will be announced through the
            staff dashboard at least 30 days before they take effect, and the &ldquo;Last
            updated&rdquo; date above will reflect the most recent revision. Continued use of the
            service after the effective date constitutes acceptance of the revised terms.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12">9. Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Questions, complaints, or notices required under these terms:{' '}
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
