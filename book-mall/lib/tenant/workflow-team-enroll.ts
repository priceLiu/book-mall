/**
 * 团队主账号 · 工作流分享 claim 后尝试将领取人加入团队（不发分享积分）。
 */
import { prisma } from "@/lib/prisma";
import { getActiveTeamOwnerTenantId } from "@/lib/referral/referral-share-persona";
import { occupyIdleSeat } from "@/lib/tenant/tenant-service";

export type WorkflowTeamEnrollResult =
  | { ok: true; tenantId: string; alreadyMember: boolean; enrolled: boolean }
  | { ok: false; reason: string };

export async function tryEnrollWorkflowClaimerInSharerTeam(input: {
  sharerUserId: string;
  claimerUserId: string;
}): Promise<WorkflowTeamEnrollResult> {
  if (input.sharerUserId === input.claimerUserId) {
    return { ok: false, reason: "不能邀请自己" };
  }

  const tenantId = await getActiveTeamOwnerTenantId(input.sharerUserId);
  if (!tenantId) {
    return { ok: false, reason: "分享者不是有效团队主账号" };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: input.claimerUserId } },
    });
    if (existing?.status === "ACTIVE") {
      return { ok: true, tenantId, alreadyMember: true, enrolled: false };
    }

    const seatId = await occupyIdleSeat(tx, tenantId);
    if (!seatId) {
      console.warn(
        "[workflow-team-enroll] no idle seat",
        tenantId,
        input.claimerUserId,
      );
      return { ok: true, tenantId, alreadyMember: false, enrolled: false };
    }

    if (existing) {
      await tx.tenantMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", role: "MEMBER", seatId },
      });
    } else {
      await tx.tenantMember.create({
        data: {
          tenantId,
          userId: input.claimerUserId,
          role: "MEMBER",
          status: "ACTIVE",
          seatId,
        },
      });
    }

    await tx.user.update({
      where: { id: input.claimerUserId },
      data: { primaryTenantId: tenantId },
    });

    return { ok: true, tenantId, alreadyMember: false, enrolled: true };
  });
}
