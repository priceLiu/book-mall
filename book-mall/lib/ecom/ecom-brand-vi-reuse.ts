import { Prisma } from "@prisma/client";

import {
  findBrandViSnapshotInProjectMeta,
} from "@/lib/ecom/ecom-brand-vi-snapshot";
import type { BrandViWorkflowSnapshot } from "@/lib/ecom/ecom-brand-vi-snapshot";
import {
  getEcomBrandViProject,
  type EcomBrandViProjectDto,
} from "@/lib/ecom/ecom-brand-vi-service";
import {
  sanitizeBrandViChatMessages,
  sanitizeBrandViReferences,
  type BrandViPlan,
  type BrandViStepState,
} from "@/lib/ecom/ecom-brand-vi-types";
import { prisma } from "@/lib/prisma";

function stripGeneratedPlan(plan: BrandViPlan): BrandViPlan {
  const steps: BrandViPlan["steps"] = {};
  for (const [id, state] of Object.entries(plan.steps ?? {})) {
    if (!state) continue;
    const next: BrandViStepState = {
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
export async function createBrandViProjectFromSnapshot(
  userId: string,
  snap: BrandViWorkflowSnapshot,
): Promise<EcomBrandViProjectDto> {
  const prevMeta = snap.meta ?? {};
  const row = await prisma.ecomBrandViProject.create({
    data: {
      userId,
      title: snap.ipName?.trim()?.slice(0, 120) || snap.title.slice(0, 120),
      references: sanitizeBrandViReferences(snap.references) as Prisma.InputJsonValue,
      chatHistory: sanitizeBrandViChatMessages(snap.chatHistory) as Prisma.InputJsonValue,
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
  const project = await getEcomBrandViProject(userId, row.id);
  if (!project) throw new Error("创建项目失败");
  return project;
}

export async function reuseBrandViLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomBrandViProjectDto> {
  const source = await getEcomBrandViProject(userId, projectId);
  if (!source) throw new Error("项目不存在");
  if (!savedAt) return source;

  const snap = findBrandViSnapshotInProjectMeta(source.meta, savedAt);
  if (!snap) throw new Error("找不到该版本快照");
  return createBrandViProjectFromSnapshot(userId, snap);
}
