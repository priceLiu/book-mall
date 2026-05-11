import Link from "next/link";
import { deleteProductForm, setProductFeaturedHome } from "@/app/actions/admin-products";
import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型",
  TOOL: "工具型",
};

const statusLabel: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "上架",
  ARCHIVED: "归档",
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: { category: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">产品管理</h1>
        <p className="text-sm text-muted-foreground">
          发布知识型 / 工具型产品；首页仅展示「已上架」且已勾选推荐的产品。
        </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">新建产品</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium w-16">封面</th>
              <th className="p-3 font-medium">名称</th>
              <th className="p-3 font-medium">类型</th>
              <th className="p-3 font-medium">分类</th>
              <th className="p-3 font-medium">价格</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">首页推荐</th>
              <th className="p-3 font-medium w-56">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-secondary/80 last:border-0 align-top">
                <td className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.coverImageUrl}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover bg-muted"
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.slug}</div>
                </td>
                <td className="p-3">{kindLabel[p.kind] ?? p.kind}</td>
                <td className="p-3 text-muted-foreground">{p.category?.name ?? "—"}</td>
                <td className="p-3 tabular-nums">¥{formatMinorAsYuan(p.priceMinor)}</td>
                <td className="p-3">{statusLabel[p.status] ?? p.status}</td>
                <td className="p-3">
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
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/products/${p.id}/edit`}>编辑</Link>
                    </Button>
                    <form action={deleteProductForm}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="destructive" size="sm">
                        删除
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
