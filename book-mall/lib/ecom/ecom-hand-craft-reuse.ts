import { Prisma } from "@prisma/client";

import {
  findHandCraftSnapshotInProjectMeta,
} from "@/lib/ecom/ecom-hand-craft-snapshot";
import type { HandCraftWorkflowSnapshot } from "@/lib/ecom/ecom-hand-craft-snapshot";
import {
  getEcomHandCraftProject,
  type EcomHandCraftProjectDto,
} from "@/lib/ecom/ecom-hand-craft-service";
import {
  sanitizeHandCraftChatMessages,
  sanitizeHandCraftReferences,
  type HandCraftPlan,
  type HandCraftStepState,
} from "@/lib/ecom/ecom-hand-craft-types";
import { prisma } from "@/lib/prisma";

function stripGeneratedPlan(plan: HandCraftPlan): HandCraftPlan {
  const steps: HandCraftPlan["steps"] = {};
  for (const [id, state] of Object.entries(plan.steps ?? {})) {
    if (!state) continue;
    const next: HandCraftStepState = {
      ...state,
      status: "pending",
      slots: state.slots.map((s) => ({
        ...s,
        imageUrl: undefined,
        assetId: undefined,
      })),
      outputs: [],
    };
    steps[id as keyof typeof steps] = next;
  }
  return { steps };
}

/** 从工作流快照创建新项目（保留线稿/槽位说明/会话，去掉已生成成图） */
export async function createHandCraftProjectFromSnapshot(
  userId: string,
  snap: HandCraftWorkflowSnapshot,
): Promise<EcomHandCraftProjectDto> {
  const prevMeta = snap.meta ?? {};
  const row = await prisma.ecomHandCraftProject.create({
    data: {
      userId,
      title: snap.ipName?.trim()?.slice(0, 120) || snap.title.slice(0, 120),
      references: sanitizeHandCraftReferences(snap.references) as Prisma.InputJsonValue,
      chatHistory: sanitizeHandCraftChatMessages(snap.chatHistory) as Prisma.InputJsonValue,
      plan: stripGeneratedPlan(snap.plan) as Prisma.InputJsonValue,
      settings: snap.settings as Prisma.InputJsonValue,
      meta: {
        ...prevMeta,
        workflow: {
          ...(prevMeta.workflow ?? {}),
          currentStepId: "hero",
          heroLockedUrl: undefined,
        },
        reusedFrom: {
          savedAt: snap.savedAt,
          title: snap.title,
          at: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
      status: "draft",
    },
  });
  const project = await getEcomHandCraftProject(userId, row.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

export async function reuseHandCraftLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomHandCraftProjectDto> {
  const source = await getEcomHandCraftProject(userId, projectId);
  if (!source) throw new Error("项目不存在");
  if (!savedAt) return source;

  const snap = findHandCraftSnapshotInProjectMeta(source.meta, savedAt);
  if (!snap) throw new Error("找不到该版本快照");
  return createHandCraftProjectFromSnapshot(userId, snap);
}
