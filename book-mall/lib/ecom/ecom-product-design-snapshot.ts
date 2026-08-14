import type { Prisma } from "@prisma/client";

import {
  normalizeEcomProjectModule,
  type EcomProjectModule,
  type ProductDesign,
  type ProductDesignChatMessage,
  type ProductDesignReference,
  type ProductDesignSettings,
} from "@/lib/ecom/ecom-product-design-types";
import {
  getProductDesignProject,
  type EcomProductDesignProjectDto,
} from "@/lib/ecom/ecom-product-design-service";
import { prisma } from "@/lib/prisma";

/** 产品创作完整工作流镜像（可一键复用、换图再出图） */
export type ProductDesignWorkflowSnapshot = {
  savedAt: string;
  /** 展示名：产品名_时间戳 */
  title: string;
  productName?: string;
  module: EcomProjectModule;
  platform: string;
  brief: Record<string, unknown> | null;
  settings: ProductDesignSettings;
  references: ProductDesignReference[];
  chatHistory: ProductDesignChatMessage[];
  design: ProductDesign | null;
  /** setupPhase / platformConfirmed / importedFrom 等 */
  meta: Record<string, unknown> | null;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "产品";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildProductDesignWorkflowSnapshotTitle(productName: string): string {
  const base = sanitizeTitleSegment(productName.trim() || "产品");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function buildProductDesignWorkflowSnapshot(
  project: EcomProductDesignProjectDto,
  productName: string,
): ProductDesignWorkflowSnapshot {
  const savedAt = new Date().toISOString();
  const trimmedName = productName.trim();
  return {
    savedAt,
    title: buildProductDesignWorkflowSnapshotTitle(trimmedName || "产品"),
    productName: trimmedName || undefined,
    module: normalizeEcomProjectModule(project.module),
    platform: project.platform,
    brief: project.brief,
    settings: project.settings,
    references: project.references,
    chatHistory: project.chatHistory,
    design: project.design,
    meta: project.meta,
  };
}

export async function saveProductDesignWorkflowSnapshot(
  projectId: string,
  snapshot: ProductDesignWorkflowSnapshot,
): Promise<void> {
  const existing = await prisma.ecomProductDesignProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as ProductDesignWorkflowSnapshot[])
    : [];
  const prevLatest = prevMeta.workflowSnapshot as ProductDesignWorkflowSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomProductDesignProject.update({
    where: { id: projectId },
    data: {
      meta: {
        ...prevMeta,
        workflowSnapshot: snapshot,
        workflowSnapshotHistory: nextHistory,
      } as Prisma.InputJsonValue,
    },
  });
}

/** 从当前项目写入工作流镜像到 meta（资产库按类目展示） */
export async function persistProductDesignWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  productName: string;
}): Promise<ProductDesignWorkflowSnapshot> {
  const project = await getProductDesignProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (!project.design) throw new Error("请先完成文案与策划，再保存工作流");

  const snapshot = buildProductDesignWorkflowSnapshot(project, opts.productName);
  await saveProductDesignWorkflowSnapshot(opts.projectId, snapshot);
  return snapshot;
}
