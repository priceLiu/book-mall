import { prisma } from "@/lib/prisma";

/** 前台 AI 学堂列表：已上架知识型产品 */
export async function listPublishedKnowledgeProducts() {
  return prisma.product.findMany({
    where: { kind: "KNOWLEDGE", status: "PUBLISHED" },
    orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
    select: {
      slug: true,
      title: true,
      summary: true,
      tier: true,
      coverImageUrl: true,
      courseContent: true,
    },
  });
}

export async function getPublishedKnowledgeProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, kind: "KNOWLEDGE", status: "PUBLISHED" },
    select: {
      slug: true,
      title: true,
      summary: true,
      description: true,
      descriptionFormat: true,
      tier: true,
      coverImageUrl: true,
      courseContent: true,
    },
  });
}
