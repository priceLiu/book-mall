import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCategory } from "@/app/actions/admin-categories";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型",
  TOOL: "工具型",
};

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [category, allCategories] = await Promise.all([
    prisma.productCategory.findUnique({ where: { id } }),
    prisma.productCategory.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/categories"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 分类列表
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">编辑分类</h1>
        <p className="text-sm text-muted-foreground">
          知识型、工具型可各建顶级分类与多级子分类；slug 用于 URL，仅限小写字母、数字与连字符。
        </p>
      </div>

      <form action={updateCategory} className="max-w-xl space-y-4 rounded-lg border border-secondary bg-card p-6">
        <input type="hidden" name="id" value={category.id} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">
            名称
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={category.name}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={category.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kind">
            品类
          </label>
          <select
            id="kind"
            name="kind"
            required
            defaultValue={category.kind}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="KNOWLEDGE">{kindLabel.KNOWLEDGE}</option>
            <option value="TOOL">{kindLabel.TOOL}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="parentId">
            父分类（可选）
          </label>
          <select
            id="parentId"
            name="parentId"
            defaultValue={category.parentId ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">（顶级）</option>
            <optgroup label="知识型">
              {allCategories
                .filter((c) => c.kind === "KNOWLEDGE" && c.id !== category.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? "└ " : ""}
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="工具型">
              {allCategories
                .filter((c) => c.kind === "TOOL" && c.id !== category.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? "└ " : ""}
                    {c.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="sortOrder">
            排序（数字越小越靠前）
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={category.sortOrder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <Button type="submit">保存</Button>
      </form>
    </div>
  );
}