import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminProductForm } from "@/components/admin/product-form";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { category: true },
    }),
    prisma.productCategory.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 sm:px-0">
      <div>
        <Link
          href={`/admin/products?kind=${product.kind}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 产品列表
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">编辑产品</h1>
      </div>
      <AdminProductForm categories={categories} product={product} />
    </div>
  );
}
