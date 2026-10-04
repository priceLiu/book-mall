import { prisma } from "@/lib/prisma";

import type { SimpleFusionProjectDto } from "./types";

export type SimpleFusionDeliverableSnapshot = {
  savedAt: string;
  project: Pick<
    SimpleFusionProjectDto,
    "id" | "module" | "title" | "settings" | "references" | "composeResult" | "meta"
  >;
};

export async function saveSimpleFusionDeliverableSnapshot(
  projectId: string,
  snapshot: SimpleFusionDeliverableSnapshot,
): Promise<void> {
  const existing = await prisma.ecomVideoWorkflowProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  if (!existing) throw new Error("项目不存在");
  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.deliverableSnapshotHistory)
    ? (prevMeta.deliverableSnapshotHistory as SimpleFusionDeliverableSnapshot[])
    : [];
  const prevLatest = prevMeta.deliverableSnapshot as SimpleFusionDeliverableSnapshot | undefined;
  const nextHistory =
    prevLatest != null ? [prevLatest, ...history].slice(0, 20) : history;

  await prisma.ecomVideoWorkflowProject.update({
    where: { id: projectId },
    data: {
      meta: {
        ...prevMeta,
        deliverableSnapshot: snapshot,
        deliverableSnapshotHistory: nextHistory,
      },
    },
  });
}
