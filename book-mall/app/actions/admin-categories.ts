"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createCategory(formData: FormData) {
  await requireAdminSession();
  const name = (formData.get("name") as string)?.trim() ?? "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() ?? "";
  const kind = formData.get("kind") as "KNOWLEDGE" | "TOOL";
  const parentId = (formData.get("parentId") as string)?.trim() || null;

  if (!name || !slug || !SLUG_RE.test(slug) || (kind !== "KNOWLEDGE" && kind !== "TOOL")) {
    throw new Error("分类名称、slug 或类型无效");
  }

  if (parentId) {
    const parent = await prisma.productCategory.findUnique({ where: { id: parentId } });
    if (!parent) throw new Error("父分类不存在");
    if (parent.kind !== kind) throw new Error("子分类必须与父分类同属知识型或工具型");
  }

  await prisma.productCategory.create({
    data: {
      name,
      slug,
      kind,
      parentId,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  redirect("/admin/categories");
}

export async function updateCategory(formData: FormData) {
  await requireAdminSession();
  const id = (formData.get("id") as string)?.trim();
  if (!id) throw new Error("缺少分类 id");

  const name = (formData.get("name") as string)?.trim() ?? "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() ?? "";
  const kind = formData.get("kind") as "KNOWLEDGE" | "TOOL";
  const parentIdRaw = (formData.get("parentId") as string)?.trim() || null;
  const parentId = parentIdRaw === "" || parentIdRaw === id ? null : parentIdRaw;

  if (!name || !slug || !SLUG_RE.test(slug) || (kind !== "KNOWLEDGE" && kind !== "TOOL")) {
    throw new Error("分类名称、slug 或类型无效");
  }

  if (parentId) {
    const parent = await prisma.productCategory.findUnique({ where: { id: parentId } });
    if (!parent) throw new Error("父分类不存在");
    if (parent.kind !== kind) throw new Error("子分类必须与父分类同属知识型或工具型");
  }

  await prisma.productCategory.update({
    where: { id },
    data: {
      name,
      slug,
      kind,
      parentId,
      sortOrder: Number(formData.get("sortOrder") || 0) || 0,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  redirect("/admin/categories");
}

export async function deleteCategoryForm(formData: FormData) {
  await requireAdminSession();
  const categoryId = (formData.get("id") as string)?.trim();
  if (!categoryId) throw new Error("缺少分类 id");

  const [childCount, productCount] = await Promise.all([
    prisma.productCategory.count({ where: { parentId: categoryId } }),
    prisma.product.count({ where: { categoryId } }),
  ]);
  if (childCount > 0) throw new Error("请先删除或使用子分类");
  if (productCount > 0) throw new Error("该分类下仍有产品，请先行调整");

  await prisma.productCategory.delete({ where: { id: categoryId } });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
}
