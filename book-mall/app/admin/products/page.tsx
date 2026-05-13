import Link from "next/link";
import { setProductFeaturedHome } from "@/app/actions/admin-products";
import { prisma } from "@/lib/prisma";
import { productPricingFootnote } from "@/lib/product-pricing-footnote";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "上架",
  ARCHIVED: "归档",
};

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

export default async function AdminProductsPage({ searchParams }: Props) {
  const kindRaw = qp(searchParams, "kind").toUpperCase();
  const tabKind = kindRaw === "TOOL" ? "TOOL" : "KNOWLEDGE";

  const products = await prisma.product.findMany({
    where: { kind: tabKind },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: { category: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-2xl font-bold">产品管理</h1>
          <p className="text-sm text-muted-foreground">
            按 Tab 管理 AI 课程与 AI 工具。不提供删除以保护历史订单与订阅；「前台暂停新订」用于不可用，
            与归档下架不同。
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>课程入口</strong>：前台「AI 学堂」路径{" "}
            <code className="font-mono text-xs">/courses</code>。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/courses" target="_blank" rel="noopener noreferrer">
              预览 AI 学堂
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/products/new?kind=${tabKind}`}>新建产品</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-secondary pb-2">
        <Button
          asChild
          variant={tabKind === "KNOWLEDGE" ? "default" : "ghost"}
          size="sm"
          className={cn(tabKind === "KNOWLEDGE" ? "" : "text-muted-foreground")}
        >
          <Link href="/admin/products?kind=KNOWLEDGE">AI 课程</Link>
        </Button>
        <Button
          asChild
          variant={tabKind === "TOOL" ? "default" : "ghost"}
          size="sm"
          className={cn(tabKind === "TOOL" ? "" : "text-muted-foreground")}
        >
          <Link href="/admin/products?kind=TOOL">AI 工具</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="align-top p-3 font-medium w-16">封面</th>
              <th className="align-top p-3 font-medium min-w-[10rem]">名称</th>
              <th className="align-top p-3 font-medium whitespace-nowrap">分类</th>
              <th className="align-top p-3 font-medium whitespace-nowrap">toolNavKey</th>
              <th className="align-top p-3 font-medium max-w-[14rem]">计费</th>
              <th className="align-top p-3 font-medium whitespace-nowrap">前台</th>
              <th className="align-top p-3 font-medium whitespace-nowrap">状态</th>
              <th className="align-top p-3 font-medium whitespace-nowrap">首页推荐</th>
              <th className="align-top p-3 font-medium w-36">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-secondary/80 last:border-0">
                <td className="align-top p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.coverImageUrl}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover bg-muted"
                  />
                </td>
                <td className="align-top p-3">
                  <div className="font-medium leading-snug">{p.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground font-mono leading-snug">
                    {p.slug}
                  </div>
                </td>
                <td className="align-top p-3 text-muted-foreground whitespace-nowrap">
                  {p.category?.name ?? "—"}
                </td>
                <td className="align-top p-3 font-mono text-xs text-muted-foreground">
                  {p.kind === "TOOL" ? (p.toolNavKey ?? "—") : "—"}
                </td>
                <td className="align-top p-3 text-muted-foreground text-xs max-w-[14rem] leading-snug">
                  {productPricingFootnote(p.kind)}
                </td>
                <td className="align-top p-3 text-xs whitespace-nowrap">
                  {p.catalogUnavailable ? (
                    <span className="text-amber-600 dark:text-amber-400">暂停新订</span>
                  ) : (
                    <span className="text-muted-foreground">可订</span>
                  )}
                </td>
                <td className="align-top p-3 whitespace-nowrap">
                  {statusLabel[p.status] ?? p.status}
                </td>
                <td className="align-top p-3">
                  <form action={setProductFeaturedHome} className="inline">
                    <input type="hidden" name="productId" value={p.id} />
                    <input type="hidden" name="featured" value={p.featuredHome ? "0" : "1"} />
                    <Button
                      type="submit"
                      variant={p.featuredHome ? "secondary" : "outline"}
                      size="sm"
                    >
                      {p.featuredHome ? "取消推荐" : "推荐首页"}
                    </Button>
                  </form>
                </td>
                <td className="align-top p-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/products/${p.id}/edit`}>编辑</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
