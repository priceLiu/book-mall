import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { Button } from "@/components/ui/button";

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

export async function FeaturedProductsSection() {
  let items: ProductWithCategory[] = [];
  try {
    items = await prisma.product.findMany({
      where: { featuredHome: true, status: "PUBLISHED" },
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
      <p className="text-sm text-muted-foreground text-center mb-10">
        管理员在后台勾选「推荐首页」后展示于此
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col rounded-xl border border-secondary/80 bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card"
          >
            <Link href={`/products/${p.slug}`} className="block flex-1 min-h-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.coverImageUrl}
                alt=""
                className="mb-4 aspect-square w-full rounded-lg object-cover bg-muted"
              />
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {categoryLine(p.kind, p.category?.name)}
              </p>
              <h3 className="text-base font-semibold leading-snug group-hover:text-primary mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{p.summary}</p>
            </Link>
            <Button asChild className="mt-4 w-full shrink-0">
              <Link href="/subscribe">订阅</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
