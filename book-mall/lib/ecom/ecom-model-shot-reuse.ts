import { Prisma } from "@prisma/client";

import { findModelShotSnapshotInProjectMeta } from "@/lib/ecom/ecom-model-shot-snapshot";
import type { ModelShotDeliverableSnapshot } from "@/lib/ecom/ecom-model-shot-snapshot";
import {
  createEcomModelShotProject,
  getEcomModelShotProject,
  type EcomModelShotProjectDto,
} from "@/lib/ecom/ecom-model-shot-service";
import {
  ECOM_MODEL_SHOT_MODULE,
  parseModelShotPlan,
  sanitizeModelShotChatMessages,
  sanitizeModelShotReferences,
  type ModelShotMeta,
} from "@/lib/ecom/ecom-model-shot-types";
import { prisma } from "@/lib/prisma";

function stripGeneratingMeta(meta: ModelShotMeta | null): ModelShotMeta | null {
  if (!meta) return null;
  const workflow = meta.workflow ? { ...meta.workflow } : undefined;
  if (workflow) {
    delete workflow.pendingPoseImages;
  }
  return {
    ...meta,
    workflow,
  };
}

function snapshotToProjectPayload(
  snap: ModelShotDeliverableSnapshot,
): Pick<
  Prisma.EcomModelShotProjectUpdateInput,
  "title" | "references" | "brief" | "settings" | "chatHistory" | "plan" | "meta" | "status"
> {
  const plan = parseModelShotPlan(snap.plan);
  return {
    title: snap.title.slice(0, 120),
    references: sanitizeModelShotReferences(snap.references) as Prisma.InputJsonValue,
    brief: (snap.brief ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    settings: (snap.settings ?? {}) as Prisma.InputJsonValue,
    chatHistory: sanitizeModelShotChatMessages(snap.chatHistory) as Prisma.InputJsonValue,
    plan: {
      ...plan,
      items: plan.items.map((item) => ({
        ...item,
        status: item.imageUrl?.trim() ? "ready" : "pending",
      })),
    } as Prisma.InputJsonValue,
    meta: {
      ...(stripGeneratingMeta(snap.meta) ?? {}),
      reusedFrom: {
        savedAt: snap.savedAt,
        title: snap.title,
        at: new Date().toISOString(),
      },
      deliverableSnapshot: snap,
    } as Prisma.InputJsonValue,
    status: plan.status === "confirmed" ? "ready" : "draft",
  };
}

/** 从交付快照创建新项目（去掉在途生成状态） */
export async function createModelShotProjectFromSnapshot(
  userId: string,
  snap: ModelShotDeliverableSnapshot,
): Promise<EcomModelShotProjectDto> {
  const created = await createEcomModelShotProject(userId, {
    title: snap.title.slice(0, 120),
  });
  await prisma.ecomModelShotProject.update({
    where: { id: created.id },
    data: snapshotToProjectPayload(snap),
  });
  const project = await getEcomModelShotProject(userId, created.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

/** 打开已有项目，或将历史快照复用到新项目 */
export async function reuseModelShotLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomModelShotProjectDto> {
  const source = await getEcomModelShotProject(userId, projectId);
  if (!source) throw new Error("项目不存在");

  if (!savedAt) return source;

  const latest = (source.meta as Record<string, unknown> | null | undefined)
    ?.deliverableSnapshot as ModelShotDeliverableSnapshot | undefined;
  if (savedAt === latest?.savedAt) {
    return createModelShotProjectFromSnapshot(userId, latest);
  }

  const historical = findModelShotSnapshotInProjectMeta(
    source.meta as Record<string, unknown> | null,
    savedAt,
  );
  if (!historical) throw new Error("找不到该版本的保存记录");
  return createModelShotProjectFromSnapshot(userId, historical);
}

export async function duplicateModelShotForShareClaim(
  claimerUserId: string,
  sourceProjectId: string,
  sharerUserId: string,
): Promise<string> {
  const source = await prisma.ecomModelShotProject.findFirst({
    where: { id: sourceProjectId, userId: sharerUserId, module: ECOM_MODEL_SHOT_MODULE },
  });
  if (!source) throw new Error("服装模特图项目不存在或无权分享");

  const created = await createEcomModelShotProject(claimerUserId, {
    title: `${source.title ?? "服装模特图"}（分享副本）`.slice(0, 120),
  });
  await prisma.ecomModelShotProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      brief: source.brief ?? Prisma.JsonNull,
      plan: source.plan ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}
