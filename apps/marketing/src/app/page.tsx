import { CTA } from '@/components/home/cta';
import { FAQ } from '@/components/home/faq';
import { Features } from '@/components/home/features';
import { Hero } from '@/components/home/hero';
import { Pricing } from '@/components/home/pricing';
import { faqPageSchema, JsonLd } from '@/lib/structured-data';

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqPageSchema()} />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
