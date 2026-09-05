import type { Prisma } from "@prisma/client";

import { HAND_CRAFT_STEPS } from "@/lib/ecom/ecom-hand-craft-steps";
import {
  getEcomHandCraftProject,
  hydrateHandCraftPlan,
  type EcomHandCraftProjectDto,
} from "@/lib/ecom/ecom-hand-craft-service";
import type {
  HandCraftChatMessage,
  HandCraftMeta,
  HandCraftPlan,
  HandCraftReference,
  HandCraftSettings,
} from "@/lib/ecom/ecom-hand-craft-types";
import { prisma } from "@/lib/prisma";

/** 手伴创作完整工作流镜像（10 步 plan + 线稿 + 会话，可一键复用） */
export type HandCraftWorkflowSnapshot = {
  savedAt: string;
  /** 展示名：IP名_时间戳 */
  title: string;
  ipName?: string;
  references: HandCraftReference[];
  chatHistory: HandCraftChatMessage[];
  plan: HandCraftPlan;
  settings: HandCraftSettings;
  meta: HandCraftMeta | null;
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

export function buildHandCraftWorkflowSnapshotTitle(ipName: string): string {
  const base = sanitizeTitleSegment(ipName.trim() || "手伴IP");
  return `${base}_${formatSnapshotTimestamp()}`;
}

export function countHandCraftGeneratedImages(plan: HandCraftPlan): number {
  let n = 0;
  for (const step of HAND_CRAFT_STEPS) {
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

export function buildHandCraftWorkflowSnapshot(
  project: EcomHandCraftProjectDto,
  ipName: string,
): HandCraftWorkflowSnapshot {
  const savedAt = new Date().toISOString();
  const trimmed = ipName.trim();
  return {
    savedAt,
    title: buildHandCraftWorkflowSnapshotTitle(trimmed || project.title?.trim() || "手伴IP"),
    ipName: trimmed || undefined,
    references: project.references,
    chatHistory: project.chatHistory,
    plan: hydrateHandCraftPlan(project.plan),
    settings: project.settings,
    meta: project.meta,
  };
}

export async function saveHandCraftWorkflowSnapshot(
  projectId: string,
  snapshot: HandCraftWorkflowSnapshot,
): Promise<void> {
  const existing = await prisma.ecomHandCraftProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");

  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as HandCraftWorkflowSnapshot[])
    : [];
  const prevLatest = prevMeta.workflowSnapshot as HandCraftWorkflowSnapshot | undefined;
  const nextHistory =
    prevLatest && prevLatest.savedAt !== snapshot.savedAt
      ? [snapshot, ...history].slice(0, 12)
      : [snapshot, ...history.filter((h) => h.savedAt !== snapshot.savedAt)].slice(0, 12);

  await prisma.ecomHandCraftProject.update({
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
async function syncHandCraftAssetProjectNames(opts: {
  userId: string;
  projectId: string;
  projectName: string;
}): Promise<void> {
  const rows = await prisma.ecomAsset.findMany({
    where: {
      userId: opts.userId,
      module: "hand-craft",
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

export async function persistHandCraftWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  ipName: string;
}): Promise<HandCraftWorkflowSnapshot> {
  const project = await getEcomHandCraftProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const imageCount = countHandCraftGeneratedImages(project.plan);
  if (project.references.length === 0 && imageCount === 0) {
    throw new Error("请先上传线稿或生成至少一张成图，再保存到资产库");
  }

  const snapshot = buildHandCraftWorkflowSnapshot(project, opts.ipName);
  await saveHandCraftWorkflowSnapshot(opts.projectId, snapshot);
  await syncHandCraftAssetProjectNames({
    userId: opts.userId,
    projectId: opts.projectId,
    projectName: snapshot.ipName?.trim() || snapshot.title,
  });
  return snapshot;
}

export function findHandCraftSnapshotInProjectMeta(
  meta: Record<string, unknown> | null | undefined,
  savedAt: string,
): HandCraftWorkflowSnapshot | null {
  const latest = meta?.workflowSnapshot as HandCraftWorkflowSnapshot | undefined;
  if (latest?.savedAt === savedAt) return latest;
  const history = Array.isArray(meta?.workflowSnapshotHistory)
    ? (meta!.workflowSnapshotHistory as HandCraftWorkflowSnapshot[])
    : [];
  return history.find((h) => h.savedAt === savedAt) ?? null;
}
