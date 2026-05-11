import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { formatMinorAsYuan } from "@/lib/currency";
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

      <article className="mt-8 space-y-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.coverImageUrl}
            alt=""
            className="w-full max-w-sm rounded-xl object-cover bg-muted aspect-square"
          />
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {product.category?.name ?? kindLabel[product.kind]} · {tierLabel[product.tier]}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.title}</h1>
            <p className="text-muted-foreground mb-4">{product.summary}</p>
            <p className="text-xl tabular-nums font-semibold">
              ¥{formatMinorAsYuan(product.priceMinor)}
            </p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none dark:prose-invert">
          <h2 className="text-lg font-semibold mt-8 mb-2">详情</h2>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{product.description}</div>

          {product.kind === "KNOWLEDGE" && product.courseContent ? (
            <>
              <h2 className="text-lg font-semibold mt-8 mb-2">课程内容</h2>
              <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                {product.courseContent}
              </div>
            </>
          ) : null}

          {product.kind === "TOOL" && (product.toolPermissions || product.meteringNote) ? (
            <>
              <h2 className="text-lg font-semibold mt-8 mb-2">工具说明</h2>
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
      </article>
    </main>
  );
}
