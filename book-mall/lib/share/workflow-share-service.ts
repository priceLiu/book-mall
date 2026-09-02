/**
 * 工作流分享 · 创建链接、claim、资源克隆
 */
import { randomBytes } from "node:crypto";

import type { WorkflowShareApp } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  buildAppWebUrl,
  getCanvasWebOrigin,
  getEcommerceWebOrigin,
  getQuickReplicaOrigin,
} from "@/lib/app-web-origins";
import {
  cloneCanvasGraphForDuplicate,
} from "@/lib/canvas/clone-canvas-graph";
import { duplicateProjectName } from "@/lib/canvas/canvas-project-service";
import { pickProjectThumbnailUrl } from "@/lib/canvas/pick-project-thumbnail";
import {
  createCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";
import {
  duplicateEcomWorkflowForShareClaim,
  ecomWorkflowShareRedirectPath,
} from "@/lib/ecom/ecom-workflow-share-duplicate";
import { prisma } from "@/lib/prisma";
import {
  assertCanShareQrTemplate,
  cloneQrTemplateForShareClaim,
} from "@/lib/quick-replica/qr-template-service";
import { getReferralEligibility, isActiveTeamOwner } from "@/lib/referral/referral-service";
import { tryEnrollWorkflowClaimerInSharerTeam } from "@/lib/tenant/workflow-team-enroll";

import {
  buildShareCodePageUrl,
  generateWorkflowShareShortCode,
} from "./share-code-service";
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
  mainSiteOrigin?: string;
}): Promise<{
  token: string;
  id: string;
  shortCode: string;
  shareUrl: string;
  /** 团队主账号工作流：用于邀请成员体验，不发分享积分 */
  teamMemberShare: boolean;
}> {
  await assertWorkflowShareEligible(input.sharerUserId);
  const teamMemberShare = await isActiveTeamOwner(input.sharerUserId);
  if (input.app === "QUICK_REPLICA") {
    await assertCanShareQrTemplate(input.sharerUserId, input.resourceId);
  }

  for (let i = 0; i < 5; i += 1) {
    const token = generateShareToken();
    const shortCode = await generateWorkflowShareShortCode(input.app);
    try {
      const row = await prisma.workflowShareLink.create({
        data: {
          token,
          shortCode,
          app: input.app,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          sharerUserId: input.sharerUserId,
          title: input.title?.trim() || null,
          maxClaims: input.maxClaims ?? null,
        },
        select: { id: true, token: true, shortCode: true },
      });
      const shareUrl = input.mainSiteOrigin
        ? buildShareCodePageUrl(input.mainSiteOrigin, row.shortCode ?? shortCode)
        : `/code/${row.shortCode ?? shortCode}`;
      return {
        id: row.id,
        token: row.token,
        shortCode: row.shortCode ?? shortCode,
        shareUrl,
        teamMemberShare,
      };
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
  resourceType: string,
): Promise<string> {
  return duplicateEcomWorkflowForShareClaim({
    resourceType,
    sourceProjectId,
    sharerUserId,
    claimerUserId,
  });
}

async function duplicateQrForShareClaim(
  claimerUserId: string,
  sourceTemplateId: string,
  _sharerUserId: string,
): Promise<string> {
  return cloneQrTemplateForShareClaim(claimerUserId, sourceTemplateId);
}

async function cloneResourceForShare(input: {
  app: WorkflowShareApp;
  resourceType: string;
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
        input.resourceType,
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
  resourceType: string;
};

export async function claimWorkflowShare(input: {
  token?: string;
  shortCode?: string;
  claimerUserId: string;
}): Promise<WorkflowShareClaimResult> {
  const token = input.token?.trim();
  const shortCode = input.shortCode?.trim().toUpperCase();
  if (!token && !shortCode) throw new Error("分享链接无效");

  const link = token
    ? await prisma.workflowShareLink.findUnique({ where: { token } })
    : await prisma.workflowShareLink.findUnique({ where: { shortCode } });
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
      resourceType: link.resourceType,
    };
  }

  const clonedResourceId = await cloneResourceForShare({
    app: link.app,
    resourceType: link.resourceType,
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

  const sharerIsTeamOwner = await isActiveTeamOwner(link.sharerUserId);
  if (sharerIsTeamOwner) {
    await tryEnrollWorkflowClaimerInSharerTeam({
      sharerUserId: link.sharerUserId,
      claimerUserId: input.claimerUserId,
    }).catch((e) => {
      console.warn("[workflow-share] team enroll failed", e);
    });
  } else {
    await lockWorkflowAttribution({
      inviteeUserId: input.claimerUserId,
      referrerUserId: link.sharerUserId,
      workflowClaimId: claim.id,
    });
  }

  return {
    claimId: claim.id,
    clonedResourceId,
    app: link.app,
    resourceType: link.resourceType,
  };
}

export function workflowShareRedirectPath(
  app: WorkflowShareApp,
  clonedResourceId: string,
  resourceType?: string,
): string {
  switch (app) {
    case "CANVAS":
      return `/canvas/${clonedResourceId}`;
    case "ECOM":
      return ecomWorkflowShareRedirectPath(resourceType ?? "", clonedResourceId);
    case "QUICK_REPLICA":
      return `/?templateId=${encodeURIComponent(clonedResourceId)}`;
    default:
      return "/";
  }
}

export function workflowShareAppOrigin(app: WorkflowShareApp): string {
  switch (app) {
    case "CANVAS":
      return getCanvasWebOrigin();
    case "ECOM":
      return getEcommerceWebOrigin();
    case "QUICK_REPLICA":
      return getQuickReplicaOrigin();
    default:
      return getCanvasWebOrigin();
  }
}

export function workflowShareAbsoluteRedirectUrl(
  app: WorkflowShareApp,
  clonedResourceId: string,
  resourceType?: string,
): string {
  return buildAppWebUrl(
    workflowShareAppOrigin(app),
    workflowShareRedirectPath(app, clonedResourceId, resourceType),
  );
}
