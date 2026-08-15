import { Prisma } from "@prisma/client";

import { findSeedVideoSnapshotInProjectMeta } from "@/lib/ecom/ecom-library-service";
import type { SeedVideoDeliverableSnapshot } from "@/lib/ecom/ecom-seed-video-snapshot";
import {
  ECOM_SEED_VIDEO_MODULE,
  type SeedVideoPlan,
  type SeedVideoProductionMode,
  type SeedVideoWorkflowPhase,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  getEcomSeedVideoProject,
  type EcomSeedVideoProjectDto,
} from "@/lib/ecom/ecom-seed-video-service";
import {
  sanitizeSeedVideoChatMessages,
  sanitizeSeedVideoReferences,
} from "@/lib/ecom/ecom-seed-video-types";
import { prisma } from "@/lib/prisma";

function stripSeedVideoPlanForReuse(plan: SeedVideoPlan | null): SeedVideoPlan | null {
  if (!plan) return null;
  const shots = plan.shots?.map((s) => ({
    ...s,
    videoUrl: undefined,
    ttsUrl: undefined,
    videoTaskId: undefined,
  }));
  const directVideo = plan.directVideo
    ? {
        ...plan.directVideo,
        videoUrl: undefined,
        taskId: undefined,
        logId: undefined,
        generatedVideos: undefined,
      }
    : undefined;
  return {
    ...plan,
    shots,
    directVideo,
    render: undefined,
  };
}

function resolveReuseWorkflowPhase(
  snap: SeedVideoDeliverableSnapshot,
): SeedVideoWorkflowPhase {
  const mode = snap.workflow?.productionMode;
  const hasDirect = Boolean(snap.plan?.directVideo?.globalPrompt?.trim());
  const hasShots = (snap.plan?.shots?.length ?? 0) >= 2;
  if (mode === "direct" && hasDirect) return "production";
  if (hasShots) return "production";
  if ((snap.plan?.scripts?.length ?? 0) >= 1) return "shots";
  return "material";
}

/** 从交付快照创建新项目（去掉成片与任务状态，保留脚本/Prompt/参考图结构） */
export async function createSeedVideoProjectFromSnapshot(
  userId: string,
  snap: SeedVideoDeliverableSnapshot,
): Promise<EcomSeedVideoProjectDto> {
  const plan = stripSeedVideoPlanForReuse(snap.plan);
  const productionMode: SeedVideoProductionMode | undefined =
    snap.workflow?.productionMode ?? (plan?.directVideo ? "direct" : "fine");

  const row = await prisma.ecomSeedVideoProject.create({
    data: {
      userId,
      title: snap.title.slice(0, 120),
      module: ECOM_SEED_VIDEO_MODULE,
      status: "plan_ready",
      references: sanitizeSeedVideoReferences(snap.references) as Prisma.InputJsonValue,
      chatHistory: sanitizeSeedVideoChatMessages(snap.chatHistory) as Prisma.InputJsonValue,
      settings: (snap.settings ?? {}) as Prisma.InputJsonValue,
      plan: (plan ?? {}) as Prisma.InputJsonValue,
      meta: {
        planningPrompt: snap.planningPrompt,
        lastAssistantRaw: undefined,
        pendingDirectVideo: null,
        pendingShotVideo: null,
        pendingShotVideos: null,
        workflow: {
          ...(snap.workflow ?? {}),
          productionMode,
          phase: resolveReuseWorkflowPhase(snap),
          planSynced: Boolean(plan?.shots?.length || plan?.directVideo?.globalPrompt),
          editingStoryboard: false,
        },
        reusedFrom: {
          savedAt: snap.savedAt,
          title: snap.title,
          at: new Date().toISOString(),
        },
        deliverableSnapshot: snap,
      } as Prisma.InputJsonValue,
    },
  });

  const project = await getEcomSeedVideoProject(userId, row.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

/** 打开已有项目，或将历史快照复用到新项目 */
export async function reuseSeedVideoLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomSeedVideoProjectDto> {
  const source = await getEcomSeedVideoProject(userId, projectId);
  if (!source) throw new Error("项目不存在");

  if (!savedAt) return source;

  const latest = source.meta?.deliverableSnapshot as SeedVideoDeliverableSnapshot | undefined;
  if (savedAt === latest?.savedAt) {
    return createSeedVideoProjectFromSnapshot(userId, latest);
  }

  const snap = findSeedVideoSnapshotInProjectMeta(
    source.meta as Record<string, unknown> | null,
    savedAt,
  );
  if (!snap) throw new Error("找不到该版本快照");
  return createSeedVideoProjectFromSnapshot(userId, snap);
}
