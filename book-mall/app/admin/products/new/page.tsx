import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminProductForm } from "@/components/admin/product-form";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

export default async function AdminProductNewPage({ searchParams }: Props) {
  const kindRaw = qp(searchParams, "kind").toUpperCase();
  const defaultKind = kindRaw === "TOOL" ? "TOOL" : "KNOWLEDGE";

  const categories = await prisma.productCategory.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 sm:px-0">
      <div>
        <Link
          href={`/admin/products?kind=${defaultKind}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 产品列表
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">新建产品</h1>
      </div>
      <AdminProductForm categories={categories} defaultKind={defaultKind} />
    </div>
  );
}
