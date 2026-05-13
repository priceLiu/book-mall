import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { productPricingFootnote } from "@/lib/product-pricing-footnote";
import { getProductHeroMarkdown } from "@/lib/product-detail-hero-markdown";
import { ProductHeroMarkdown } from "@/components/products/product-hero-markdown";
import { ProductDescriptionBody } from "@/components/products/product-description-body";
import type { Prisma } from "@prisma/client";

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型（课程）",
  TOOL: "工具型（应用）",
};

const tierLabel: Record<string, string> = {
  BASIC: "基础",
  ADVANCED: "高级",
};

export default async function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  let product: ProductWithCategory | null = null;
  try {
    product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: { category: true },
    });
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("ProductDetailPage", e);
    return (
      <main className="container max-w-screen-lg mx-auto px-4 py-16">
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
          暂时无法连接数据库，无法加载产品详情。请稍后重试。
        </p>
        <Link href="/products" className="text-primary underline">
          返回产品列表
        </Link>
      </main>
    );
  }

  if (!product || product.status !== "PUBLISHED") notFound();

  const listHref = product.kind === "TOOL" ? "/products/ai-apps" : "/products/ai-courses";
  const listLabel = product.kind === "TOOL" ? "AI 应用" : "AI 课程";
  const heroMarkdown = getProductHeroMarkdown(product.slug);

  return (
    <main className="container max-w-screen-lg mx-auto px-4 pb-16 pt-6 sm:pt-8 md:pt-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href={listHref} className="hover:text-foreground">
          ← {listLabel}
        </Link>
        <span className="hidden sm:inline">·</span>
        <Link href="/products" className="hover:text-foreground">
          全部产品
        </Link>
      </div>

      <article className="mt-6 md:mt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8 lg:gap-10">
          <div className="w-full shrink-0 self-center md:w-[272px] md:max-w-[272px] md:self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.coverImageUrl}
              alt=""
              className="aspect-square w-full rounded-xl bg-muted object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            {heroMarkdown ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  {product.category?.name ?? kindLabel[product.kind]} · {tierLabel[product.tier]}
                </p>
                <h1 className="mb-3 text-2xl font-bold text-foreground md:mb-4 md:text-3xl">{product.title}</h1>
                <ProductHeroMarkdown content={heroMarkdown} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  {product.category?.name ?? kindLabel[product.kind]} · {tierLabel[product.tier]}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.title}</h1>
                <p className="text-muted-foreground mb-4">{product.summary}</p>
                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
                  {productPricingFootnote(product.kind)}
                </p>
              </>
            )}

            <div className="prose prose-invert mt-5 max-w-none dark:prose-invert md:mt-6">
              <h2 className="mb-2 mt-0 text-lg font-semibold first:mt-0">详情</h2>
              <ProductDescriptionBody
                description={product.description}
                format={product.descriptionFormat}
              />

              {product.kind === "KNOWLEDGE" && product.courseContent ? (
                <>
                  <h2 className="mb-2 mt-6 text-lg font-semibold">课程内容</h2>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {product.courseContent}
                  </div>
                </>
              ) : null}

              {product.kind === "TOOL" && (product.toolPermissions || product.meteringNote) ? (
                <>
                  <h2 className="mb-2 mt-6 text-lg font-semibold">工具说明</h2>
                  {product.toolPermissions ? (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium mb-1">权限</h3>
                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {product.toolPermissions}
                      </div>
                    </div>
                  ) : null}
                  {product.meteringNote ? (
                    <div>
                      <h3 className="text-sm font-medium mb-1">大模型计费</h3>
                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {product.meteringNote}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
