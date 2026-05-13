import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { productPricingFootnote } from "@/lib/product-pricing-footnote";
import type { Prisma, ProductKind } from "@prisma/client";

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

const tierLabel: Record<string, string> = {
  BASIC: "基础",
  ADVANCED: "高级",
};

const kindFallbackCategory: Record<ProductKind, string> = {
  KNOWLEDGE: "AI 课程",
  TOOL: "AI 应用",
};

export async function PublishedProductList({
  kind,
  emptyMessage = "暂无已上架产品。",
}: {
  kind: ProductKind;
  emptyMessage?: string;
}) {
  let products: ProductWithCategory[] = [];
  try {
    products = await prisma.product.findMany({
      where: { status: "PUBLISHED", kind, catalogUnavailable: false },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
      include: { category: true },
    });
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("PublishedProductList", e);
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        暂时无法连接数据库，产品列表加载失败。请检查网络与数据库状态后刷新页面。
      </p>
    );
  }

  if (products.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/products/${p.slug}`}
          className="group flex flex-col rounded-xl border border-secondary/80 bg-card/40 p-4 transition hover:border-primary/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.coverImageUrl}
            alt=""
            className="mb-4 aspect-square w-full rounded-lg object-cover bg-muted"
          />
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {p.category?.name ?? kindFallbackCategory[p.kind]}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {tierLabel[p.tier] ?? p.tier}
            </span>
          </div>
          <h2 className="text-base font-semibold group-hover:text-primary mb-2 leading-snug">
            {p.title}
          </h2>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{p.summary}</p>
          <p className="text-xs text-muted-foreground leading-snug">{productPricingFootnote(p.kind)}</p>
        </Link>
      ))}
    </div>
  );
}
