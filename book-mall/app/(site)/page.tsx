import { BenefitsSection } from "@/components/layout/sections/benefits";
import { CommunitySection } from "@/components/layout/sections/community";
import { FeaturesSection } from "@/components/layout/sections/features";
import { FeaturedProductsSection } from "@/components/layout/sections/featured-products";
import { FooterSection } from "@/components/layout/sections/footer";
import { SiteHomeHeroSection } from "@/components/layout/site-home/site-home-hero";
import { SiteHomeLogoMarquee } from "@/components/layout/site-home/site-home-logo-marquee";
import { PricingSection } from "@/components/layout/sections/pricing";
import { TestimonialSection } from "@/components/layout/sections/testimonial";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "智选 AI Mall｜找AI上智选",
  description:
    "一人公司、创业老板、自由职业的专属 AI 加油站；一站式找工具、用应用、学课程，打通「找、用、学」闭环。",
  openGraph: {
    type: "website",
    url: "https://book.ai-code8.com",
    title: "智选 AI Mall｜找AI上智选",
    description:
      "一人公司、创业老板、自由职业的专属 AI 加油站；一站式找工具、用应用、学课程，打通「找、用、学」闭环。",
    images: [
      {
        url: "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
        width: 1200,
        height: 630,
        alt: "智选 AI Mall — 找AI上智选",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://book.ai-code8.com",
    title: "智选 AI Mall｜找AI上智选",
    description:
      "一人公司、创业老板、自由职业的专属 AI 加油站；一站式找工具、用应用、学课程，打通「找、用、学」闭环。",
    images: [
      "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
    ],
  },
};

export default function Home() {
  return (
    <>
      <SiteHomeHeroSection />
      <SiteHomeLogoMarquee />
      <div className="site-home-below-hero">
        <FeaturedProductsSection />
        <BenefitsSection />
        <FeaturesSection />
        <TestimonialSection />
        <CommunitySection />
        <PricingSection />
        <FooterSection />
      </div>
    </>
  );
}
