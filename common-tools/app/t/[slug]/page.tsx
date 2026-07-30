import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolPageClient } from "./tool-page-client";
import { getLiveTool, LIVE_TOOLS } from "@/lib/tools-registry";
import type { ImageProcessingTagId } from "@/lib/image-processing-tags";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return LIVE_TOOLS.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const tool = getLiveTool(params.slug);
  if (!tool) return { title: "未找到" };
  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
  };
}

export default function ToolPage({ params }: Props) {
  const tool = getLiveTool(params.slug);
  if (!tool) notFound();
  return <ToolPageClient slug={params.slug as ImageProcessingTagId} />;
}
