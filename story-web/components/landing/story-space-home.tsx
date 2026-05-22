import type { StorySpaceData } from "@/lib/story-api";
import type { LandingShowcase } from "@/lib/landing-showcase";
import { TwentyLanding } from "@/components/landing/twenty/twenty-landing";
import { getBookMallOrigin } from "@/lib/site-config";

type StorySpaceHomeProps = {
  space: StorySpaceData;
  showcase: LandingShowcase;
  onPublish?: () => void;
  publishing?: boolean;
  publishError?: string | null;
};

export function StorySpaceHome({
  space,
  showcase,
  onPublish,
  publishing,
  publishError,
}: StorySpaceHomeProps) {
  const bookMall = getBookMallOrigin();
  const productUrl = space.publishedProductSlug
    ? `${bookMall}/products/${space.publishedProductSlug}`
    : null;

  return (
    <TwentyLanding
      tagline={space.tagline}
      subtitle={space.subtitle}
      eyebrow={`${space.ownerDisplayName ?? "创作者"} · ${space.slug}`}
      showcase={showcase}
      isOwner={space.isOwner}
      onPublish={onPublish}
      publishing={publishing}
      publishError={publishError}
      publishedProductUrl={productUrl}
    />
  );
}
