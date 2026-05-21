import { FAQ_ITEMS, PLANS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_LINKS } from './constants';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
    sameAs: [SOCIAL_LINKS.twitter, SOCIAL_LINKS.instagram, SOCIAL_LINKS.linkedin],
  };
}

export function softwareApplicationSchema() {
  const lowestPaid = PLANS.find((p) => p.price > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    url: SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: `Free plan available. Paid plans from $${lowestPaid?.price ?? 10}/month.`,
    },
  };
}

export function faqPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON is trusted
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
