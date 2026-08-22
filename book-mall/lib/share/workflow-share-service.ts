/**
 * 工作流分享 · 创建链接、claim、资源克隆
 */
import { randomBytes } from "node:crypto";

import type { WorkflowShareApp } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  cloneCanvasGraphForDuplicate,
  duplicateProjectName,
  pickProjectThumbnailUrl,
} from "@/lib/canvas/clone-canvas-graph";
import {
  createCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";
import { createEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { prisma } from "@/lib/prisma";
import { rowToJson } from "@/lib/quick-replica/qr-template-service";
import { getReferralEligibility } from "@/lib/referral/referral-service";

import {
  lockWorkflowAttribution,
} from "./share-reward-service";

function generateShareToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function assertWorkflowShareEligible(userId: string): Promise<void> {
  const elig = await getReferralEligibility(userId);
  if (!elig.eligible) {
    throw new Error(elig.reason ?? "不满足分享门禁");
  }
}

export async function createWorkflowShareLink(input: {
  sharerUserId: string;
  app: WorkflowShareApp;
  resourceType: string;
  resourceId: string;
  title?: string | null;
  maxClaims?: number | null;
}): Promise<{ token: string; id: string }> {
  await assertWorkflowShareEligible(input.sharerUserId);

  for (let i = 0; i < 5; i += 1) {
    const token = generateShareToken();
    try {
      const row = await prisma.workflowShareLink.create({
        data: {
          token,
          app: input.app,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          sharerUserId: input.sharerUserId,
          title: input.title?.trim() || null,
          maxClaims: input.maxClaims ?? null,
        },
        select: { id: true, token: true },
      });
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("生成分享链接失败");
}

export type WorkflowSharePublicMeta = {
  token: string;
  app: WorkflowShareApp;
  title: string | null;
  resourceType: string;
  sharerName: string | null;
  enabled: boolean;
  expired: boolean;
};

export async function getWorkflowSharePublicMeta(
  token: string,
): Promise<WorkflowSharePublicMeta | null> {
  const row = await prisma.workflowShareLink.findUnique({
    where: { token },
    include: { sharer: { select: { name: true } } },
  });
  if (!row) return null;
  const expired =
    (row.expiresAt != null && row.expiresAt < new Date()) ||
    (row.maxClaims != null && row.claimCount >= row.maxClaims);
  return {
    token: row.token,
    app: row.app,
    title: row.title,
    resourceType: row.resourceType,
    sharerName: row.sharer.name,
    enabled: row.enabled && !expired,
    expired,
  };
}

async function duplicateCanvasForShareClaim(
  claimerUserId: string,
  sourceProjectId: string,
  sharerUserId: string,
): Promise<string> {
  const source = await prisma.canvasProject.findFirst({
    where: { id: sourceProjectId, userId: sharerUserId, deletedAt: null },
  });
  if (!source) throw new Error("画布不存在或无权分享");

  const canvas = cloneCanvasGraphForDuplicate(source.canvas);
  const thumbnailUrl =
    source.thumbnailUrl?.trim() || pickProjectThumbnailUrl(source.canvas) || "";
  const created = await createCanvasProjectForUser(claimerUserId, {
    name: duplicateProjectName(source.name),
    description: source.description,
    canvas,
  });
  if (thumbnailUrl) {
    await prisma.canvasProject.update({
      where: { id: created.id },
      data: { thumbnailUrl },
    });
  }
  return created.id;
}

async function duplicateEcomForShareClaim(
  claimerUserId: string,
  sourceProjectId: string,
  sharerUserId: string,
): Promise<string> {
  const source = await prisma.ecomStoryboardProject.findFirst({
    where: { id: sourceProjectId, userId: sharerUserId },
  });
  if (!source) throw new Error("分镜项目不存在或无权分享");

  const created = await createEcomStoryboardProject(claimerUserId, {
    title: `${source.title}（分享副本）`.slice(0, 120),
    brief: (source.brief ?? {}) as Record<string, unknown>,
  });
  await prisma.ecomStoryboardProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      sheet: source.sheet ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
    },
  });
  return created.id;
}

async function duplicateQrForShareClaim(
  claimerUserId: string,
  sourceTemplateId: string,
  sharerUserId: string,
): Promise<string> {
  const source = await prisma.qrTemplate.findFirst({
    where: { id: sourceTemplateId, ownerUserId: sharerUserId, deletedAt: null },
  });
  if (!source) throw new Error("模板不存在或无权分享");

  const row = await prisma.qrTemplate.create({
    data: {
      ownerUserId: claimerUserId,
      category: source.category,
      kind: source.kind,
      toolKey: source.toolKey,
      title: `${source.title}（分享副本）`.slice(0, 120),
      thumbnailUrl: source.thumbnailUrl,
      badges: source.badges ?? [],
      visibility: "private",
      reference: source.reference as Prisma.InputJsonValue,
      output: source.output ? (source.output as Prisma.InputJsonValue) : undefined,
      sortOrder: 0,
    },
  });
  return rowToJson(row).id;
}

async function cloneResourceForShare(input: {
  app: WorkflowShareApp;
  resourceId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  switch (input.app) {
    case "CANVAS":
      return duplicateCanvasForShareClaim(
        input.claimerUserId,
        input.resourceId,
        input.sharerUserId,
      );
    case "ECOM":
      return duplicateEcomForShareClaim(
        input.claimerUserId,
        input.resourceId,
        input.sharerUserId,
      );
    case "QUICK_REPLICA":
      return duplicateQrForShareClaim(
        input.claimerUserId,
        input.resourceId,
        input.sharerUserId,
      );
    default:
      throw new Error("不支持的应用");
  }
}

export type WorkflowShareClaimResult = {
  claimId: string;
  clonedResourceId: string;
  app: WorkflowShareApp;
};

export async function claimWorkflowShare(input: {
  token: string;
  claimerUserId: string;
}): Promise<WorkflowShareClaimResult> {
  const link = await prisma.workflowShareLink.findUnique({
    where: { token: input.token },
  });
  if (!link || !link.enabled) throw new Error("分享链接无效");
  if (link.expiresAt && link.expiresAt < new Date()) throw new Error("分享链接已过期");
  if (link.maxClaims != null && link.claimCount >= link.maxClaims) {
    throw new Error("分享链接已达领取上限");
  }

  const existing = await prisma.workflowShareClaim.findUnique({
    where: {
      shareLinkId_claimerUserId: {
        shareLinkId: link.id,
        claimerUserId: input.claimerUserId,
      },
    },
  });
  if (existing) {
    return {
      claimId: existing.id,
      clonedResourceId: existing.clonedResourceId,
      app: link.app,
    };
  }

  const clonedResourceId = await cloneResourceForShare({
    app: link.app,
    resourceId: link.resourceId,
    sharerUserId: link.sharerUserId,
    claimerUserId: input.claimerUserId,
  });

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowShareClaim.create({
      data: {
        shareLinkId: link.id,
        claimerUserId: input.claimerUserId,
        clonedResourceId,
      },
    });
    await tx.workflowShareLink.update({
      where: { id: link.id },
      data: { claimCount: { increment: 1 } },
    });
    return created;
  });

  await lockWorkflowAttribution({
    inviteeUserId: input.claimerUserId,
    referrerUserId: link.sharerUserId,
    workflowClaimId: claim.id,
  });

  return {
    claimId: claim.id,
    clonedResourceId,
    app: link.app,
  };
}

export function workflowShareRedirectPath(
  app: WorkflowShareApp,
  clonedResourceId: string,
): string {
  switch (app) {
    case "CANVAS":
      return `/canvas/${clonedResourceId}`;
    case "ECOM":
      return `/ecom/storyboard/micro-drama?projectId=${encodeURIComponent(clonedResourceId)}`;
    case "QUICK_REPLICA":
      return `/?templateId=${encodeURIComponent(clonedResourceId)}`;
    default:
      return "/";
  }
}
