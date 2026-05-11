"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parsePriceMinor(formData: FormData): number {
  const raw = (formData.get("priceYuan") as string)?.trim() ?? "0";
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export async function createProduct(formData: FormData) {
  await requireAdminSession();
  const title = (formData.get("title") as string)?.trim() ?? "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() ?? "";
  const summary = (formData.get("summary") as string)?.trim() ?? "";
  const description = (formData.get("description") as string)?.trim() ?? "";
  const kind = formData.get("kind") as "KNOWLEDGE" | "TOOL";
  const tier = formData.get("tier") as "BASIC" | "ADVANCED";
  const status = formData.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  const coverImageUrl = (formData.get("coverImageUrl") as string)?.trim() ?? "";
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const courseContent = (formData.get("courseContent") as string)?.trim() || null;
  const toolPermissions = (formData.get("toolPermissions") as string)?.trim() || null;
  const meteringNote = (formData.get("meteringNote") as string)?.trim() || null;
  const featuredHome = formData.get("featuredHome") === "on";
  const featuredSort = Number(formData.get("featuredSort") || 0) || 0;
  const priceMinor = parsePriceMinor(formData);

  if (!title || !slug || !SLUG_RE.test(slug) || !summary || !coverImageUrl) {
    throw new Error("请填写标题、slug、概述与封面 URL");
  }
  if (kind !== "KNOWLEDGE" && kind !== "TOOL") throw new Error("产品类型无效");
  if (tier !== "BASIC" && tier !== "ADVANCED") throw new Error("档位无效");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    throw new Error("状态无效");
  }

  await prisma.product.create({
    data: {
      title,
      slug,
      summary,
      description,
      kind,
      tier,
      status,
      priceMinor,
      coverImageUrl,
      categoryId,
      courseContent: courseContent || null,
      toolPermissions: toolPermissions || null,
      meteringNote: meteringNote || null,
      featuredHome,
      featuredSort,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function updateProduct(formData: FormData) {
  await requireAdminSession();
  const id = (formData.get("id") as string)?.trim();
  if (!id) throw new Error("缺少产品 id");

  const title = (formData.get("title") as string)?.trim() ?? "";
  const slug = (formData.get("slug") as string)?.trim().toLowerCase() ?? "";
  const summary = (formData.get("summary") as string)?.trim() ?? "";
  const description = (formData.get("description") as string)?.trim() ?? "";
  const kind = formData.get("kind") as "KNOWLEDGE" | "TOOL";
  const tier = formData.get("tier") as "BASIC" | "ADVANCED";
  const status = formData.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  const coverImageUrl = (formData.get("coverImageUrl") as string)?.trim() ?? "";
  const categoryId = (formData.get("categoryId") as string)?.trim() || null;
  const courseContent = (formData.get("courseContent") as string)?.trim() || null;
  const toolPermissions = (formData.get("toolPermissions") as string)?.trim() || null;
  const meteringNote = (formData.get("meteringNote") as string)?.trim() || null;
  const featuredHome = formData.get("featuredHome") === "on";
  const featuredSort = Number(formData.get("featuredSort") || 0) || 0;
  const priceMinor = parsePriceMinor(formData);

  if (!title || !slug || !SLUG_RE.test(slug) || !summary || !coverImageUrl) {
    throw new Error("请填写标题、slug、概述与封面 URL");
  }
  if (kind !== "KNOWLEDGE" && kind !== "TOOL") throw new Error("产品类型无效");
  if (tier !== "BASIC" && tier !== "ADVANCED") throw new Error("档位无效");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    throw new Error("状态无效");
  }

  await prisma.product.update({
    where: { id },
    data: {
      title,
      slug,
      summary,
      description,
      kind,
      tier,
      status,
      priceMinor,
      coverImageUrl,
      categoryId,
      courseContent: courseContent || null,
      toolPermissions: toolPermissions || null,
      meteringNote: meteringNote || null,
      featuredHome,
      featuredSort,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProductForm(formData: FormData) {
  await requireAdminSession();
  const productId = (formData.get("id") as string)?.trim();
  if (!productId) throw new Error("缺少产品 id");

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/");
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function setProductFeaturedHome(formData: FormData) {
  await requireAdminSession();
  const productId = (formData.get("productId") as string)?.trim();
  const featured = (formData.get("featured") as string)?.trim() === "1";
  if (!productId) throw new Error("缺少产品 id");

  await prisma.product.update({
    where: { id: productId },
    data: { featuredHome: featured },
  });

  revalidatePath("/");
  revalidatePath("/admin/products");
  revalidatePath("/products");
}
