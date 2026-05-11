import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminProductForm } from "@/components/admin/product-form";

export default async function AdminProductNewPage() {
  const categories = await prisma.productCategory.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 产品列表
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">新建产品</h1>
      </div>
      <AdminProductForm categories={categories} />
    </div>
  );
}
