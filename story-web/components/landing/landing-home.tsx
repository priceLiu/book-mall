import { DEMO_SPACE } from "@/lib/site-config";
import type { LandingShowcase } from "@/lib/landing-showcase";
import { TwentyLanding } from "@/components/landing/twenty/twenty-landing";

type DemoSpace = typeof DEMO_SPACE;

export function LandingHome({
  demo,
  showcase,
}: {
  demo: DemoSpace;
  showcase: LandingShowcase;
}) {
  return (
    <TwentyLanding
      tagline="漫剧的未来，是搭建出来的，不是买来的。"
      subtitle={demo.subtitle}
      eyebrow="story-web · 演示空间 · 模板 v1"
      showcase={showcase}
    />
  );
}
