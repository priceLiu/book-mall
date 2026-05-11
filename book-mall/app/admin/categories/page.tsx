import Link from "next/link";
import { deleteCategoryForm } from "@/app/actions/admin-categories";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型",
  TOOL: "工具型",
};

export default async function AdminCategoriesPage() {
  const categories = await prisma.productCategory.findMany({
    orderBy: [{ kind: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { parent: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">产品分类</h1>
          <p className="text-sm text-muted-foreground">
            知识型、工具型分类与子分类；删除前需清空下级分类与关联产品。
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">新增分类</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">名称</th>
              <th className="p-3 font-medium">Slug</th>
              <th className="p-3 font-medium">品类</th>
              <th className="p-3 font-medium">父级</th>
              <th className="p-3 font-medium">排序</th>
              <th className="p-3 font-medium w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-secondary/80 last:border-0">
                <td className="p-3">
                  {c.parentId ? (
                    <span className="text-muted-foreground">└ </span>
                  ) : null}
                  {c.name}
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{c.slug}</td>
                <td className="p-3">{kindLabel[c.kind] ?? c.kind}</td>
                <td className="p-3 text-muted-foreground">{c.parent?.name ?? "—"}</td>
                <td className="p-3 tabular-nums">{c.sortOrder}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/categories/${c.id}/edit`}>编辑</Link>
                    </Button>
                    <form action={deleteCategoryForm}>
                      <input type="hidden" name="id" value={c.id} />
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
