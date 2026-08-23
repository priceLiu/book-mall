import { BenefitsSection } from "@/components/layout/sections/benefits";
import { CommunitySection } from "@/components/layout/sections/community";
import { FeaturesSection } from "@/components/layout/sections/features";
import { SiteHomeGatewayModelsSection } from "@/components/layout/site-home/site-home-gateway-models-section";
import { SiteHomePlatformNavSection } from "@/components/layout/site-home/site-home-platform-nav-section";
import { FooterSection } from "@/components/layout/sections/footer";
import { SiteHomeHeroSection } from "@/components/layout/site-home/site-home-hero";
import { getSiteHomeSnapshotForRender } from "@/lib/static-snapshots/site-home-snapshot-service";
import { buildSiteHomePlatformApps } from "@/lib/site-home/platform-apps";
import { TestimonialSection } from "@/components/layout/sections/testimonial";

export const revalidate = 86400;

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

export default async function Home() {
  const snapshot = await getSiteHomeSnapshotForRender();
  const liveHrefByKey = new Map(
    buildSiteHomePlatformApps().map((app) => [app.key, app.href]),
  );
  const platformApps = snapshot.payload.platformApps.map((app) => ({
    ...app,
    href: liveHrefByKey.get(app.key) ?? app.href,
  }));

  return (
    <>
      <SiteHomeHeroSection
        clips={snapshot.payload.hero.clips}
        background={snapshot.payload.hero.background}
      />
      <SiteHomePlatformNavSection platformApps={platformApps} />
      <div className="site-home-below-hero">
        <SiteHomeGatewayModelsSection
          models={snapshot.payload.gatewayModels}
          gatewayOrigin={snapshot.payload.gatewayOrigin}
        />
        <BenefitsSection />
        <FeaturesSection />
        <TestimonialSection />
        <CommunitySection />
        <FooterSection />
      </div>
    </>
  );
}
