import type { Prisma } from "@prisma/client";

import {
  getEcomIpMasterProject,
  type EcomIpMasterProjectDto,
} from "@/lib/ecom/ecom-ip-master-service";
import type {
  IpMasterChatMessage,
  IpMasterMeta,
  IpMasterPlan,
  IpMasterReference,
  IpMasterSettings,
} from "@/lib/ecom/ecom-ip-master-types";
import { prisma } from "@/lib/prisma";

export type IpMasterWorkflowSnapshot = {
  savedAt: string;
  title: string;
  ipName?: string;
  references: IpMasterReference[];
  chatHistory: IpMasterChatMessage[];
  plan: IpMasterPlan;
  settings: IpMasterSettings;
  meta: IpMasterMeta | null;
  brief: Record<string, unknown> | null;
};

function sanitizeTitleSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "IP母版";
}

function formatSnapshotTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function buildIpMasterWorkflowSnapshotTitle(ipName: string): string {
  return `${sanitizeTitleSegment(ipName)}_${formatSnapshotTimestamp()}`;
}

export function buildIpMasterWorkflowSnapshot(
  project: EcomIpMasterProjectDto,
  ipName: string,
): IpMasterWorkflowSnapshot {
  const trimmed = ipName.trim();
  return {
    savedAt: new Date().toISOString(),
    title: buildIpMasterWorkflowSnapshotTitle(trimmed || project.title?.trim() || "IP母版"),
    ipName: trimmed || undefined,
    references: project.references,
    chatHistory: project.chatHistory,
    plan: project.plan,
    settings: project.settings,
    meta: project.meta,
    brief: project.brief,
  };
}

export async function persistIpMasterWorkflowSnapshot(opts: {
  userId: string;
  projectId: string;
  ipName: string;
}): Promise<IpMasterWorkflowSnapshot> {
  const project = await getEcomIpMasterProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const hasTemplate = (project.meta?.templateVersions?.length ?? 0) > 0;
  if (!hasTemplate && project.references.length === 0) {
    throw new Error("请先保存至少一版模板或上传基准图");
  }

  const snapshot = buildIpMasterWorkflowSnapshot(project, opts.ipName);
  const existing = await prisma.ecomIpMasterProject.findFirst({
    where: { id: opts.projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const history = Array.isArray(prevMeta.workflowSnapshotHistory)
    ? (prevMeta.workflowSnapshotHistory as IpMasterWorkflowSnapshot[])
    : [];

  await prisma.ecomIpMasterProject.update({
    where: { id: opts.projectId },
    data: {
      meta: {
        ...prevMeta,
        workflowSnapshot: snapshot,
        workflowSnapshotHistory: [snapshot, ...history].slice(0, 12),
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: "ip-master",
      kind: "workflow",
      title: snapshot.title.slice(0, 120),
      ossUrl: "",
      meta: {
        projectId: opts.projectId,
        savedAt: snapshot.savedAt,
        source: "ip-master-workflow",
      },
    },
  });

  return snapshot;
}
