import type { Prisma } from "@prisma/client";

import { listToolWorkShowcaseItems } from "@/lib/site-home/tool-works-showcase";

export type FeaturedShowcaseCard = {
  id: string;
  imageUrl: string;
  videoUrl: string | null;
  title: string;
  summary?: string;
  categoryLabel: string;
  coverAspect: string;
  detailHref: string | null;
  buttonHref: string | null;
  buttonLabel: string | null;
};

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

const FEATURED_COVER_ASPECT: Record<string, string> = {
  "tool-text-to-image": "aspect-square",
  "tool-smart-support": "aspect-[1024/922]",
  "tool-ai-fit": "aspect-[525/741]",
};

function categoryLine(
  kind: "KNOWLEDGE" | "TOOL",
  categoryName: string | null | undefined,
) {
  if (categoryName) return categoryName;
  return kind === "TOOL" ? "AI 应用" : "AI 课程";
}

function productDetailHref(product: ProductWithCategory): string {
  return product.kind === "KNOWLEDGE"
    ? `/courses/${product.slug}`
    : `/products/${product.slug}`;
}

function productButtonLabel(kind: "KNOWLEDGE" | "TOOL"): string {
  return kind === "KNOWLEDGE" ? "进入 AI 学堂" : "查看应用";
}

/** 推荐产品走马灯：首页 featured 产品 + 工具站作品，产品优先。 */
export const FEATURED_SHOWCASE_TOTAL_MAX = 20;
export const FEATURED_SHOWCASE_QUICK_REPLICA_MAX = 8;

export function buildFeaturedShowcaseCards(
  products: ProductWithCategory[],
  productSlugByNavKey: Map<string, string>,
): FeaturedShowcaseCard[] {
  const cards: FeaturedShowcaseCard[] = products.map((p) => {
    const href = productDetailHref(p);
    return {
      id: `product-${p.id}`,
      imageUrl: p.coverImageUrl,
      videoUrl: null,
      title: p.title,
      summary: p.summary,
      categoryLabel: categoryLine(p.kind, p.category?.name),
      coverAspect: FEATURED_COVER_ASPECT[p.slug] ?? "aspect-square",
      detailHref: href,
      buttonHref: href,
      buttonLabel: productButtonLabel(p.kind),
    };
  });

  const toolSlots = Math.max(0, FEATURED_SHOWCASE_TOTAL_MAX - cards.length);
  const works = listToolWorkShowcaseItems(productSlugByNavKey, {
    maxItems: toolSlots,
    quickReplicaMax: Math.min(FEATURED_SHOWCASE_QUICK_REPLICA_MAX, toolSlots),
  });
  for (const work of works) {
    cards.push({
      id: work.id,
      imageUrl: work.imageUrl,
      videoUrl: work.videoUrl,
      title: work.title,
      categoryLabel: work.categoryLabel,
      coverAspect: "aspect-square",
      detailHref: work.productHref,
      buttonHref: work.productHref,
      buttonLabel: work.productHref ? "查看应用" : null,
    });
  }

  return cards.slice(0, FEATURED_SHOWCASE_TOTAL_MAX);
}
