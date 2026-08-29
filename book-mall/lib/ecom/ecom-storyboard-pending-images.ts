import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type StoryboardPendingPanelImageEntry = {
  startedAt: string;
  modelKey?: string;
};

export type StoryboardPendingPanelImagesMap = Record<
  string,
  StoryboardPendingPanelImageEntry
>;

function panelKey(index: number): string {
  return String(Math.trunc(index));
}

export function readStoryboardPendingPanelImages(
  meta: unknown,
): StoryboardPendingPanelImagesMap {
  const workflow = (meta as Record<string, unknown> | null)?.workflow as
    | Record<string, unknown>
    | undefined;
  const raw = workflow?.pendingPanelImages;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoryboardPendingPanelImagesMap = {};
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
    };
  }
  return out;
}

export function listStoryboardPendingPanelImageIndices(meta: unknown): number[] {
  return Object.keys(readStoryboardPendingPanelImages(meta))
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
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

export async function markStoryboardPanelImagesPending(
  projectId: string,
  panelIndexes: number[],
  modelKey?: string,
): Promise<void> {
  const startedAt = new Date().toISOString();
  await patchStoryboardWorkflowMeta(projectId, (workflow) => {
    const prev = readStoryboardPendingPanelImages({ workflow });
    const next: StoryboardPendingPanelImagesMap = { ...prev };
    for (const index of panelIndexes) {
      next[panelKey(index)] = {
        startedAt,
        ...(modelKey?.trim() ? { modelKey: modelKey.trim() } : {}),
      };
    }
    workflow.pendingPanelImages = next;
    workflow.phase = "image";
  });
}

export async function clearStoryboardPanelImagesPending(
  projectId: string,
  panelIndexes: number[],
): Promise<void> {
  if (panelIndexes.length === 0) return;
  await patchStoryboardWorkflowMeta(projectId, (workflow) => {
    const prev = readStoryboardPendingPanelImages({ workflow });
    const next = { ...prev };
    for (const index of panelIndexes) {
      delete next[panelKey(index)];
    }
    if (Object.keys(next).length === 0) {
      delete workflow.pendingPanelImages;
    } else {
      workflow.pendingPanelImages = next;
    }
  });
}
