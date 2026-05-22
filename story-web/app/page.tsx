import { StoryHomePageClient } from "@/components/landing/story-home-page-client";
import { getLandingShowcase } from "@/lib/landing-showcase.server";

export default function HomePage() {
  const showcase = getLandingShowcase();
  return <StoryHomePageClient showcase={showcase} />;
}
