import { prisma } from "@/lib/prisma";
import {
  getRepoDocFileTimes,
  isAllowedRepoDocPath,
  scanRepoDocsMarkdownFiles,
} from "@/lib/admin/read-repo-doc";

export type AdminPendingFeatureRow = {
  id: string;
  title: string;
  description: string;
  docPath: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  docFileCreatedAt: string | null;
  docFileUpdatedAt: string | null;
};

function mapRow(row: {
  id: string;
  title: string;
  description: string;
  docPath: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): AdminPendingFeatureRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    docPath: row.docPath,
    completed: row.completed,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    docFileCreatedAt: null,
    docFileUpdatedAt: null,
  };
}

async function attachDocFileTimes(
  row: AdminPendingFeatureRow,
): Promise<AdminPendingFeatureRow> {
  const docPath = row.docPath.trim();
  if (!docPath) return row;
  const times = await getRepoDocFileTimes(docPath);
  if (!times) return row;
  return {
    ...row,
    docFileCreatedAt: times.createdAt,
    docFileUpdatedAt: times.updatedAt,
  };
}

export async function listAdminPendingFeatures(opts?: {
  completed?: boolean;
}): Promise<AdminPendingFeatureRow[]> {
  const rows = await prisma.adminPendingFeature.findMany({
    where:
      typeof opts?.completed === "boolean"
        ? { completed: opts.completed }
        : undefined,
    orderBy: [{ completed: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const mapped = rows.map(mapRow);
  return Promise.all(mapped.map(attachDocFileTimes));
}

export async function createAdminPendingFeature(input: {
  title: string;
  description?: string;
  docPath?: string;
  sortOrder?: number;
}): Promise<AdminPendingFeatureRow> {
  const title = input.title.trim();
  if (!title) throw new Error("标题不能为空");

  const docPath = (input.docPath ?? "").trim();
  if (docPath && !isAllowedRepoDocPath(docPath)) {
    throw new Error("文档路径须以 docs/ 或 book-mall/doc/ 开头");
  }

  let sortOrder = input.sortOrder;
  if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
    const max = await prisma.adminPendingFeature.aggregate({
      _max: { sortOrder: true },
    });
    sortOrder = (max._max.sortOrder ?? 0) + 10;
  }

  const row = await prisma.adminPendingFeature.create({
    data: {
      title,
      description: input.description?.trim() ?? "",
      docPath,
      sortOrder,
    },
  });
  return mapRow(row);
}

export async function updateAdminPendingFeature(
  id: string,
  patch: {
    title?: string;
    description?: string;
    docPath?: string;
    completed?: boolean;
    sortOrder?: number;
  },
): Promise<AdminPendingFeatureRow> {
  const existing = await prisma.adminPendingFeature.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  const data: {
    title?: string;
    description?: string;
    docPath?: string;
    completed?: boolean;
    sortOrder?: number;
  } = {};

  if (typeof patch.title === "string") {
    const title = patch.title.trim();
    if (!title) throw new Error("标题不能为空");
    data.title = title;
  }
  if (typeof patch.description === "string") {
    data.description = patch.description.trim();
  }
  if (typeof patch.docPath === "string") {
    const docPath = patch.docPath.trim();
    if (docPath && !isAllowedRepoDocPath(docPath)) {
      throw new Error("文档路径须以 docs/ 或 book-mall/doc/ 开头");
    }
    data.docPath = docPath;
  }
  if (typeof patch.completed === "boolean") {
    data.completed = patch.completed;
  }
  if (typeof patch.sortOrder === "number" && Number.isFinite(patch.sortOrder)) {
    data.sortOrder = patch.sortOrder;
  }

  const row = await prisma.adminPendingFeature.update({
    where: { id },
    data,
  });
  return mapRow(row);
}

export async function deleteAdminPendingFeature(id: string): Promise<void> {
  try {
    await prisma.adminPendingFeature.delete({ where: { id } });
  } catch {
    throw new Error("NOT_FOUND");
  }
}

/** 从 docs 目录下全部 .md 批量导入（按 docPath 去重，已存在则跳过） */
export async function importAdminPendingFeaturesFromDocs(): Promise<{
  created: number;
  skipped: number;
  totalInDocs: number;
}> {
  const docs = await scanRepoDocsMarkdownFiles();
  if (docs.length === 0) {
    return { created: 0, skipped: 0, totalInDocs: 0 };
  }

  const existing = await prisma.adminPendingFeature.findMany({
    select: { docPath: true },
  });
  const existingPaths = new Set(
    existing.map((r) => r.docPath.trim()).filter(Boolean),
  );

  let created = 0;
  let skipped = 0;
  let sortBase = 0;
  const max = await prisma.adminPendingFeature.aggregate({
    _max: { sortOrder: true },
  });
  sortBase = max._max.sortOrder ?? 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (existingPaths.has(doc.docPath)) {
      skipped += 1;
      continue;
    }
    await prisma.adminPendingFeature.create({
      data: {
        title: doc.title,
        description: doc.description,
        docPath: doc.docPath,
        completed: false,
        sortOrder: sortBase + (i + 1) * 10,
      },
    });
    existingPaths.add(doc.docPath);
    created += 1;
  }

  return { created, skipped, totalInDocs: docs.length };
}
