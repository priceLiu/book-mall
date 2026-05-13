import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { productPricingFootnote } from "@/lib/product-pricing-footnote";
import type { Prisma } from "@prisma/client";

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "AI 课程",
  TOOL: "AI 应用",
};

const tierLabel: Record<string, string> = {
  BASIC: "基础",
  ADVANCED: "高级",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  if (searchParams.kind === "TOOL") redirect("/products/ai-apps");
  if (searchParams.kind === "KNOWLEDGE") redirect("/products/ai-courses");

  let products: ProductWithCategory[] = [];
  let dbUnavailable = false;
  try {
    products = await prisma.product.findMany({
      where: { status: "PUBLISHED", catalogUnavailable: false },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
      include: { category: true },
    });
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("ProductsPage", e);
    dbUnavailable = true;
  }

  return (
    <main className="container max-w-screen-xl mx-auto px-4 pb-16 pt-6 sm:pt-8 md:pt-10">
      {dbUnavailable ? (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          暂时无法连接数据库，列表可能为空。请检查网络与 Neon 后刷新。
        </p>
      ) : null}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">全部产品</h1>
          <p className="text-sm text-muted-foreground mt-1">
            浏览已上架的知识与工具产品；按类型进入专属列表。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/products"
            className="rounded-md border border-primary bg-primary/10 px-3 py-1.5"
          >
            全部
          </Link>
          <Link
            href="/products/ai-apps"
            className="rounded-md border border-secondary px-3 py-1.5 hover:bg-muted"
          >
            AI 应用
          </Link>
          <Link
            href="/products/ai-courses"
            className="rounded-md border border-secondary px-3 py-1.5 hover:bg-muted"
          >
            AI 课程
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground">暂无已上架产品。</p>
      ) : (
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
                  {p.category?.name ?? kindLabel[p.kind]}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
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
      )}
    </main>
  );
}
