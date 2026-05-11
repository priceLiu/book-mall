import type { Product, ProductCategory } from "@prisma/client";
import { createProduct, updateProduct } from "@/app/actions/admin-products";
import { formatMinorAsYuan } from "@/lib/currency";
import { Button } from "@/components/ui/button";

const kindLabel: Record<string, string> = {
  KNOWLEDGE: "知识型（课程）",
  TOOL: "工具型（应用）",
};

type ProductWithCat = Product & { category?: ProductCategory | null };

export function AdminProductForm({
  categories,
  product,
}: {
  categories: ProductCategory[];
  product?: ProductWithCat | null;
}) {
  const action = product ? updateProduct : createProduct;
  const priceDefault = product ? formatMinorAsYuan(product.priceMinor) : "0";

  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-lg border border-secondary bg-card p-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="title">
            产品名称
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={product?.title}
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
            defaultValue={product?.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="priceYuan">
            标价（元）
          </label>
          <input
            id="priceYuan"
            name="priceYuan"
            type="text"
            inputMode="decimal"
            defaultValue={priceDefault}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="coverImageUrl">
            封面图 URL
          </label>
          <input
            id="coverImageUrl"
            name="coverImageUrl"
            required
            defaultValue={product?.coverImageUrl}
            placeholder="https://..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="summary">
            一句话概述
          </label>
          <input
            id="summary"
            name="summary"
            required
            defaultValue={product?.summary}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kind">
            类型
          </label>
          <select
            id="kind"
            name="kind"
            required
            defaultValue={product?.kind ?? "KNOWLEDGE"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="KNOWLEDGE">{kindLabel.KNOWLEDGE}</option>
            <option value="TOOL">{kindLabel.TOOL}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="tier">
            档位
          </label>
          <select
            id="tier"
            name="tier"
            required
            defaultValue={product?.tier ?? "BASIC"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="BASIC">基础</option>
            <option value="ADVANCED">高级</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="status">
            上下架
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={product?.status ?? "DRAFT"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">上架</option>
            <option value="ARCHIVED">下架归档</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="categoryId">
            分类
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={product?.categoryId ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">（未选择）</option>
            <optgroup label="知识型">
              {categories
                .filter((c) => c.kind === "KNOWLEDGE")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? "└ " : ""}
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="工具型">
              {categories
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
        <div className="space-y-2 sm:col-span-2 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featuredHome"
              defaultChecked={product?.featuredHome ?? false}
              className="h-4 w-4 rounded border-input"
            />
            推荐到首页（须已上架）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">首页顺序</span>
            <input
              name="featuredSort"
              type="number"
              defaultValue={product?.featuredSort ?? 0}
              className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="description">
            产品详情
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            defaultValue={product?.description ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="courseContent">
            课程内容（知识型）
          </label>
          <textarea
            id="courseContent"
            name="courseContent"
            rows={4}
            defaultValue={product?.courseContent ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="toolPermissions">
            工具权限说明（工具型）
          </label>
          <textarea
            id="toolPermissions"
            name="toolPermissions"
            rows={3}
            defaultValue={product?.toolPermissions ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="meteringNote">
            大模型计费说明（工具型）
          </label>
          <textarea
            id="meteringNote"
            name="meteringNote"
            rows={3}
            defaultValue={product?.meteringNote ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <Button type="submit">{product ? "保存" : "创建产品"}</Button>
    </form>
  );
}
