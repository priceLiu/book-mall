import type { Prisma } from "@prisma/client";

import {
  getProductImageSetProject,
} from "@/lib/ecom/product-image-set/project-service";
import type { ProductImageSetProject } from "@/lib/ecom/product-image-set/types";
import type {
  ProductImageSetMeta,
  ProductImageSetOutput,
  ProductImageSetReference,
  ProductImageSetSettings,
} from "@/lib/ecom/product-image-set/types";
import { prisma } from "@/lib/prisma";

export type ProductImageSetWorkflowSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  references: ProductImageSetReference[];
  settings: ProductImageSetSettings;
  output: ProductImageSetOutput;
  meta: ProductImageSetMeta;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "商品套图";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildProductImageSetWorkflowSnapshotTitle(productName: string): string {
  const base = sanitizeTitleSegment(productName.trim() || "商品套图");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function buildProductImageSetWorkflowSnapshot(
  project: ProductImageSetProject,
  productName: string,
): ProductImageSetWorkflowSnapshot {
  const savedAt = new Date().toISOString();
  const trimmed = productName.trim();
  return {
    savedAt,
    title: buildProductImageSetWorkflowSnapshotTitle(trimmed || project.title?.trim() || "商品套图"),
    productName: trimmed || undefined,
    references: project.references,
    settings: project.settings,
    output: project.output,
    meta: project.meta,
  };
}

export async function saveProductImageSetWorkflowSnapshot(
  projectId: string,
  snapshot: ProductImageSetWorkflowSnapshot,
): Promise<void> {
  const existing = await prisma.ecomProductImageSetProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");

  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as ProductImageSetWorkflowSnapshot[])
    : [];
  const prevLatest = prevMeta.workflowSnapshot as ProductImageSetWorkflowSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomProductImageSetProject.update({
    where: { id: projectId },
    data: {
      title: snapshot.productName?.slice(0, 120) || undefined,
      meta: {
        ...prevMeta,
        workflowSnapshot: snapshot,
        workflowSnapshotHistory: nextHistory,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function persistProductImageSetWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  productName: string;
}): Promise<ProductImageSetWorkflowSnapshot> {
  const project = await getProductImageSetProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const hasWork =
    project.references.length > 0 ||
    project.output.slots.length > 0 ||
    Boolean(project.meta.sellpointDocument?.trim());
  if (!hasWork) {
    throw new Error("请先上传商品原图或生成套图占位，再保存工作流");
  }

  const snapshot = buildProductImageSetWorkflowSnapshot(project, opts.productName);
  await saveProductImageSetWorkflowSnapshot(opts.projectId, snapshot);
  return snapshot;
}
