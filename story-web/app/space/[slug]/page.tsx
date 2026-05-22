import { StorySpacePublicClient } from "./story-space-public-client";
import { getLandingShowcase } from "@/lib/landing-showcase.server";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  return { title: `${params.slug} 的空间` };
}

export default function StorySpaceSlugPage({ params }: Props) {
  const showcase = getLandingShowcase();
  return <StorySpacePublicClient slug={params.slug} showcase={showcase} />;
}
