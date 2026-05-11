import Link from "next/link";
import { createCategory } from "@/app/actions/admin-categories";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型",
  TOOL: "工具型",
};

export default async function AdminCategoryNewPage() {
  const allCategories = await prisma.productCategory.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/categories"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 分类列表
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">新增分类</h1>
      </div>

      <form action={createCategory} className="max-w-xl space-y-4 rounded-lg border border-secondary bg-card p-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">
            名称
          </label>
          <input
            id="name"
            name="name"
            required
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
            placeholder="例如 ai-courses"
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
            defaultValue="KNOWLEDGE"
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
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">（顶级）</option>
            <optgroup label="知识型">
              {allCategories
                .filter((c) => c.kind === "KNOWLEDGE")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? "└ " : ""}
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="工具型">
              {allCategories
                .filter((c) => c.kind === "TOOL")
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
            排序
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <Button type="submit">创建</Button>
      </form>
    </div>
  );
}
