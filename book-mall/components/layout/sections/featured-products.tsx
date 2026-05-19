import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

function categoryLine(
  kind: "KNOWLEDGE" | "TOOL",
  categoryName: string | null | undefined,
) {
  if (categoryName) return categoryName;
  return kind === "TOOL" ? "AI 应用" : "AI 课程";
}

/** 封面图区域保持原有比例，不在纵向被 flex 拉伸 */
const FEATURED_COVER_ASPECT: Record<string, string> = {
  "tool-text-to-image": "aspect-square",
  "tool-smart-support": "aspect-[1024/922]",
  "tool-ai-fit": "aspect-[525/741]",
};

export async function FeaturedProductsSection() {
  let items: ProductWithCategory[] = [];
  try {
    items = await prisma.product.findMany({
      where: { featuredHome: true, status: "PUBLISHED", catalogUnavailable: false },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
      take: 12,
      include: { category: true },
    });
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("FeaturedProductsSection", e);
    return null;
  }

  if (items.length === 0) return null;

  return (
    <section id="featured-products" className="max-w-[75%] mx-auto py-16 sm:py-20">
      <h2 className="text-lg md:text-xl text-center mb-2">推荐产品</h2>
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto leading-relaxed">
      </p>
      <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div
            key={p.id}
            className="group flex h-full flex-col rounded-xl border border-secondary/80 bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card"
          >
            <Link
              href={p.kind === "KNOWLEDGE" ? `/courses/${p.slug}` : `/products/${p.slug}`}
              className="flex min-h-0 flex-1 flex-col rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={cn(
                  "relative mb-4 w-full shrink-0 overflow-hidden rounded-2xl bg-muted",
                  FEATURED_COVER_ASPECT[p.slug] ?? "aspect-square",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.coverImageUrl}
                  alt={p.title}
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
              {/* 同一行卡片被 grid 拉高时，仅把文案压到按钮上方，与图区高度/比例无关 */}
              <div className="mt-auto shrink-0">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {categoryLine(p.kind, p.category?.name)}
                </p>
                <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
                  {p.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
              </div>
            </Link>
            <Button asChild className="mt-4 w-full shrink-0">
              <Link href={p.kind === "KNOWLEDGE" ? `/courses/${p.slug}` : `/products/${p.slug}`}>
                {p.kind === "KNOWLEDGE" ? "进入 AI 学堂" : "查看应用"}
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
