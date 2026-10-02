import type { Prisma } from "@prisma/client";

import { BRAND_VI_STEPS } from "@/lib/ecom/ecom-brand-vi-steps";
import {
  getEcomBrandViProject,
  hydrateBrandViPlan,
  type EcomBrandViProjectDto,
} from "@/lib/ecom/ecom-brand-vi-service";
import type {
  BrandViChatMessage,
  BrandViMeta,
  BrandViPlan,
  BrandViReference,
  BrandViSettings,
} from "@/lib/ecom/ecom-brand-vi-types";
import { prisma } from "@/lib/prisma";

/** 手伴创作完整工作流镜像（10 步 plan + 线稿 + 会话，可一键复用） */
export type BrandViWorkflowSnapshot = {
  savedAt: string;
  /** 展示名：IP名_时间戳 */
  title: string;
  ipName?: string;
  references: BrandViReference[];
  chatHistory: BrandViChatMessage[];
  plan: BrandViPlan;
  settings: BrandViSettings;
  meta: BrandViMeta | null;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "手伴IP";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildBrandViWorkflowSnapshotTitle(ipName: string): string {
  const base = sanitizeTitleSegment(ipName.trim() || "手伴IP");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function countBrandViGeneratedImages(plan: BrandViPlan): number {
  let n = 0;
  for (const step of BRAND_VI_STEPS) {
    const state = plan.steps[step.id];
    if (!state) continue;
    if (step.kind === "compose") {
      n += state.outputs.filter((o) => o.imageUrl?.trim()).length;
    } else {
      n += state.slots.filter((s) => s.imageUrl?.trim()).length;
    }
  }
  return n;
}

export function buildBrandViWorkflowSnapshot(
  project: EcomBrandViProjectDto,
  ipName: string,
): BrandViWorkflowSnapshot {
  const savedAt = new Date().toISOString();
  const trimmed = ipName.trim();
  return {
    savedAt,
    title: buildBrandViWorkflowSnapshotTitle(trimmed || project.title?.trim() || "手伴IP"),
    ipName: trimmed || undefined,
    references: project.references,
    chatHistory: project.chatHistory,
    plan: hydrateBrandViPlan(project.plan),
    settings: project.settings,
    meta: project.meta,
  };
}

export async function saveBrandViWorkflowSnapshot(
  projectId: string,
  snapshot: BrandViWorkflowSnapshot,
): Promise<void> {
  const existing = await prisma.ecomBrandViProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");

  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as BrandViWorkflowSnapshot[])
    : [];
  const prevLatest = prevMeta.workflowSnapshot as BrandViWorkflowSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomBrandViProject.update({
    where: { id: projectId },
    data: {
      title: snapshot.ipName?.slice(0, 120) || undefined,
      meta: {
        ...prevMeta,
        workflowSnapshot: snapshot,
        workflowSnapshotHistory: nextHistory,
      } as Prisma.InputJsonValue,
    },
  });
}

/** 保存时将本项目已入库成图的 projectName 同步为本次 IP 名，便于资产库分组 */
async function syncBrandViAssetProjectNames(opts: {
  userId: string;
  projectId: string;
  projectName: string;
}): Promise<void> {
  const rows = await prisma.ecomAsset.findMany({
    where: {
      userId: opts.userId,
      module: "brand-vi",
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, meta: true },
  });
  for (const row of rows) {
    const meta = (row.meta as Record<string, unknown> | null) ?? {};
    if (meta.projectId !== opts.projectId) continue;
    await prisma.ecomAsset.update({
      where: { id: row.id },
      data: {
        meta: {
          ...meta,
          projectName: opts.projectName,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function persistBrandViWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  ipName: string;
}): Promise<BrandViWorkflowSnapshot> {
  const project = await getEcomBrandViProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const imageCount = countBrandViGeneratedImages(project.plan);
  if (project.references.length === 0 && imageCount === 0) {
    throw new Error("请先上传线稿或生成至少一张成图，再保存到资产库");
  }

  const snapshot = buildBrandViWorkflowSnapshot(project, opts.ipName);
  await saveBrandViWorkflowSnapshot(opts.projectId, snapshot);
  await syncBrandViAssetProjectNames({
    userId: opts.userId,
    projectId: opts.projectId,
    projectName: snapshot.ipName?.trim() || snapshot.title,
  });
  return snapshot;
}

export function findBrandViSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): BrandViWorkflowSnapshot | null {
  const latest = meta?.workflowSnapshot as BrandViWorkflowSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as BrandViWorkflowSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}
