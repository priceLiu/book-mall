import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type StoryboardPendingPanelVideoEntry = {
  startedAt: string;
  modelKey?: string;
  taskId?: string;
  logId?: string;
  pollProvider?: "bailian" | "volcengine" | "dashscope" | "kie" | "minimax";
  /** 提交后暂存，resume 时写回 panel */
  durationSec?: number;
  resolution?: string;
  aspectRatio?: "16:9" | "9:16";
  prompt?: string;
};

export type StoryboardPendingPanelVideosMap = Record<
  string,
  StoryboardPendingPanelVideoEntry
>;

function panelKey(index: number): string {
  return String(Math.trunc(index));
}

export function readStoryboardPendingPanelVideos(
  meta: unknown,
): StoryboardPendingPanelVideosMap {
  const workflow = (meta as Record<string, unknown> | null)?.workflow as
    | Record<string, unknown>
    | undefined;
  const raw = workflow?.pendingPanelVideos;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoryboardPendingPanelVideosMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const startedAt =
      typeof entry.startedAt === "string" ? entry.startedAt.trim() : "";
    if (!startedAt) continue;
    out[key] = {
      startedAt,
      ...(typeof entry.modelKey === "string" && entry.modelKey.trim()
        ? { modelKey: entry.modelKey.trim() }
        : {}),
      ...(typeof entry.taskId === "string" && entry.taskId.trim()
        ? { taskId: entry.taskId.trim() }
        : {}),
      ...(typeof entry.logId === "string" && entry.logId.trim()
        ? { logId: entry.logId.trim() }
        : {}),
      ...(typeof entry.pollProvider === "string" && entry.pollProvider.trim()
        ? {
            pollProvider: entry.pollProvider.trim() as StoryboardPendingPanelVideoEntry["pollProvider"],
          }
        : {}),
      ...(typeof entry.durationSec === "number" && Number.isFinite(entry.durationSec)
        ? { durationSec: entry.durationSec }
        : {}),
      ...(typeof entry.resolution === "string" && entry.resolution.trim()
        ? { resolution: entry.resolution.trim() }
        : {}),
      ...(entry.aspectRatio === "16:9" || entry.aspectRatio === "9:16"
        ? { aspectRatio: entry.aspectRatio }
        : {}),
      ...(typeof entry.prompt === "string" && entry.prompt.trim()
        ? { prompt: entry.prompt.trim() }
        : {}),
    };
  }
  return out;
}

export function listStoryboardPendingPanelVideoIndices(meta: unknown): number[] {
  return Object.keys(readStoryboardPendingPanelVideos(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

/** 单镜视频服务端最长约 10min；超时视为 stale pending */
export const STORYBOARD_PENDING_PANEL_VIDEO_TTL_MS = 25 * 60 * 1000;
/** 已 mark pending 但尚未写入 Gateway taskId 的宽限期 */
export const STORYBOARD_PENDING_PANEL_VIDEO_SUBMIT_GRACE_MS = 3 * 60 * 1000;

/** 清除已完成、超时或未提交成功的 pending，避免前端误判「生成中」 */
export function reconcileStoryboardPendingPanelVideoMeta(opts: {
  meta: unknown;
  sheet: { panels?: Array<{ index: number; videoUrl?: string | null }> } | null;
}): { meta: Record<string, unknown>; changed: boolean } {
  const prevMeta =
    opts.meta && typeof opts.meta === "object" && !Array.isArray(opts.meta)
      ? ({ ...(opts.meta as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const workflow =
    prevMeta.workflow && typeof prevMeta.workflow === "object" && !Array.isArray(prevMeta.workflow)
      ? ({ ...(prevMeta.workflow as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const map = readStoryboardPendingPanelVideos(prevMeta);
  const keys = Object.keys(map);
  if (keys.length === 0) return { meta: prevMeta, changed: false };

  let changed = false;
  const nextMap: StoryboardPendingPanelVideosMap = { ...map };
  const panels = opts.sheet?.panels ?? [];

  for (const key of keys) {
    const panelIndex = Number.parseInt(key, 10);
    const entry = map[key];
    if (!Number.isFinite(panelIndex) || !entry) {
      delete nextMap[key];
      changed = true;
      continue;
    }

    const panel = panels.find((p) => p.index === panelIndex);
    if (panel?.videoUrl?.trim()) {
      delete nextMap[key];
      changed = true;
      continue;
    }

    const startedAt = entry.startedAt ? Date.parse(entry.startedAt) : NaN;
    if (Number.isFinite(startedAt)) {
      const ageMs = Date.now() - startedAt;
      if (ageMs > STORYBOARD_PENDING_PANEL_VIDEO_TTL_MS) {
        delete nextMap[key];
        changed = true;
        continue;
      }
      if (!entry.taskId?.trim() && ageMs > STORYBOARD_PENDING_PANEL_VIDEO_SUBMIT_GRACE_MS) {
        delete nextMap[key];
        changed = true;
        continue;
      }
    }
  }

  if (!changed) return { meta: prevMeta, changed: false };

  const nextMeta = { ...prevMeta, workflow: { ...workflow } };
  if (Object.keys(nextMap).length === 0) {
    delete (nextMeta.workflow as Record<string, unknown>).pendingPanelVideos;
  } else {
    (nextMeta.workflow as Record<string, unknown>).pendingPanelVideos = nextMap;
  }
  return { meta: nextMeta, changed: true };
}

async function patchStoryboardWorkflowMeta(
  projectId: string,
  mutate: (workflow: Record<string, unknown>) => void,
): Promise<void> {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");
  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const workflow = {
    ...((prevMeta.workflow as Record<string, unknown> | undefined) ?? {}),
  };
  mutate(workflow);
  await prisma.ecomStoryboardProject.update({
    where: { id: projectId },
    data: {
      meta: { ...prevMeta, workflow } as Prisma.InputJsonValue,
    },
  });
}

export async function markStoryboardPanelVideosPending(
  projectId: string,
  panelIndexes: number[],
  modelKey?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  await patchStoryboardWorkflowMeta(projectId, (workflow) => {
    const prev = readStoryboardPendingPanelVideos({ workflow });
    const next: StoryboardPendingPanelVideosMap = { ...prev };
    for (const index of panelIndexes) {
      next[panelKey(index)] = {
        startedAt,
        ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
      };
    }
    workflow.pendingPanelVideos = next;
    workflow.phase = "video";
  });
}

export async function clearStoryboardPanelVideosPending(
  projectId: string,
  panelIndexes: number[],
): Promise<void> {
  if (panelIndexes.length === 0) return;
  await patchStoryboardWorkflowMeta(projectId, (workflow) => {
    const prev = readStoryboardPendingPanelVideos({ workflow });
    const next = { ...prev };
    for (const index of panelIndexes) {
      delete next[panelKey(index)];
    }
    if (Object.keys(next).length === 0) {
      delete workflow.pendingPanelVideos;
    } else {
      workflow.pendingPanelVideos = next;
    }
  });
}

export async function updateStoryboardPanelVideoPendingEntry(
  projectId: string,
  panelIndex: number,
  patch: Partial<StoryboardPendingPanelVideoEntry>,
): Promise<void> {
  await patchStoryboardWorkflowMeta(projectId, (workflow) => {
    const prev = readStoryboardPendingPanelVideos({ workflow });
    const key = panelKey(panelIndex);
    const cur = prev[key];
    if (!cur) return;
    workflow.pendingPanelVideos = {
      ...prev,
      [key]: { ...cur, ...patch },
    };
  });
}
