import { CTA } from '@/components/home/cta';
import { FAQ } from '@/components/home/faq';
import { Features } from '@/components/home/features';
import { Hero } from '@/components/home/hero';
import { Pricing } from '@/components/home/pricing';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
