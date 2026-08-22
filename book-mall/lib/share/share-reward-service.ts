/**
 * 分享规则 2.0 · 归因锁定与积分发奖
 *
 * - 先到先得：ShareRewardAttribution 终身一条
 * - 邀请：注册 + 首笔付费 → referralRewardCredits
 * - 工作流：首次扣积分生成 + 首笔付费 → workflowShareRewardCredits
 * - 同一 invitee 仅发一笔（幂等键 share_reward:{inviteeUserId}）
 */
import type { ShareRewardChannel } from "@prisma/client";

import { topupCredits } from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";

import {
  getShareRewardConfig,
  QUALIFYING_FIRST_PAY_ORDER_TYPES,
} from "./share-reward-config";

function shareRewardIdempotencyKey(inviteeUserId: string): string {
  return `share_reward:${inviteeUserId}`;
}

async function ensureProgress(inviteeUserId: string) {
  return prisma.shareRewardProgress.upsert({
    where: { inviteeUserId },
    create: { inviteeUserId },
    update: {},
  });
}

/** 注册归因：先到先得锁定 REFERRAL */
export async function lockReferralAttribution(input: {
  inviteeUserId: string;
  referrerUserId: string;
  referralCode?: string | null;
}): Promise<void> {
  if (input.inviteeUserId === input.referrerUserId) return;

  const existing = await prisma.shareRewardAttribution.findUnique({
    where: { inviteeUserId: input.inviteeUserId },
  });
  if (existing) return;

  try {
    await prisma.shareRewardAttribution.create({
      data: {
        inviteeUserId: input.inviteeUserId,
        channel: "REFERRAL",
        referrerUserId: input.referrerUserId,
        referralCode: input.referralCode?.trim() || null,
      },
    });
    await ensureProgress(input.inviteeUserId);
  } catch (e) {
    // 并发注册：唯一约束冲突可忽略
    console.warn("[share-reward] lockReferralAttribution race", e);
  }
}

/** 工作流 claim 归因：先到先得锁定 WORKFLOW */
export async function lockWorkflowAttribution(input: {
  inviteeUserId: string;
  referrerUserId: string;
  workflowClaimId: string;
}): Promise<void> {
  if (input.inviteeUserId === input.referrerUserId) return;

  const existing = await prisma.shareRewardAttribution.findUnique({
    where: { inviteeUserId: input.inviteeUserId },
  });
  if (existing) return;

  try {
    await prisma.shareRewardAttribution.create({
      data: {
        inviteeUserId: input.inviteeUserId,
        channel: "WORKFLOW",
        referrerUserId: input.referrerUserId,
        workflowClaimId: input.workflowClaimId,
      },
    });
    await ensureProgress(input.inviteeUserId);
  } catch (e) {
    console.warn("[share-reward] lockWorkflowAttribution race", e);
  }
}

/** Gateway 首次成功扣积分生成 */
export async function markShareRewardFirstBillable(inviteeUserId: string): Promise<void> {
  if (!inviteeUserId) return;

  const progress = await prisma.shareRewardProgress.findUnique({
    where: { inviteeUserId },
  });
  if (progress?.firstBillableAt) return;

  await prisma.shareRewardProgress.upsert({
    where: { inviteeUserId },
    create: { inviteeUserId, firstBillableAt: new Date() },
    update: { firstBillableAt: new Date() },
  });

  await tryGrantShareReward(inviteeUserId).catch((e) => {
    console.warn("[share-reward] tryGrant after firstBillable failed", inviteeUserId, e);
  });
}

/** 首笔订阅或积分充值入账后 */
export async function markShareRewardFirstPaid(inviteeUserId: string): Promise<void> {
  if (!inviteeUserId) return;

  const priorPaid = await prisma.order.count({
    where: {
      userId: inviteeUserId,
      status: "PAID",
      type: { in: [...QUALIFYING_FIRST_PAY_ORDER_TYPES] },
    },
  });
  if (priorPaid !== 1) return;

  const progress = await prisma.shareRewardProgress.findUnique({
    where: { inviteeUserId },
  });
  if (progress?.firstPaidAt) return;

  await prisma.shareRewardProgress.upsert({
    where: { inviteeUserId },
    create: { inviteeUserId, firstPaidAt: new Date() },
    update: { firstPaidAt: new Date() },
  });

  await tryGrantShareReward(inviteeUserId).catch((e) => {
    console.warn("[share-reward] tryGrant after firstPaid failed", inviteeUserId, e);
  });
}

function channelReady(
  channel: ShareRewardChannel,
  progress: { firstBillableAt: Date | null; firstPaidAt: Date | null },
): boolean {
  if (!progress.firstPaidAt) return false;
  if (channel === "REFERRAL") return true;
  return progress.firstBillableAt != null;
}

async function referrerDailyCapOk(
  referrerUserId: string,
  cap: number,
  grantCredits: number,
): Promise<boolean> {
  if (cap <= 0) return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.shareRewardGrant.aggregate({
    where: { referrerUserId, grantedAt: { gte: start } },
    _sum: { credits: true },
  });
  const used = agg._sum.credits ?? 0;
  return used + grantCredits <= cap;
}

/** 两条件齐 → 发奖（幂等） */
export async function tryGrantShareReward(inviteeUserId: string): Promise<boolean> {
  const idempotencyKey = shareRewardIdempotencyKey(inviteeUserId);
  const existingGrant = await prisma.shareRewardGrant.findUnique({
    where: { idempotencyKey },
  });
  if (existingGrant) return false;

  const attribution = await prisma.shareRewardAttribution.findUnique({
    where: { inviteeUserId },
  });
  if (!attribution) return false;

  const progress = await prisma.shareRewardProgress.findUnique({
    where: { inviteeUserId },
  });
  if (!progress || !channelReady(attribution.channel, progress)) return false;

  const cfg = await getShareRewardConfig();
  const credits =
    attribution.channel === "WORKFLOW"
      ? cfg.workflowShareRewardCredits
      : cfg.referralRewardCredits;
  if (credits <= 0) return false;

  const capOk = await referrerDailyCapOk(
    attribution.referrerUserId,
    cfg.shareRewardDailyCapPerReferrer,
    credits,
  );
  if (!capOk) return false;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + cfg.shareRewardCreditsExpireDays);

  try {
    await prisma.$transaction(async (tx) => {
      const dup = await tx.shareRewardGrant.findUnique({ where: { idempotencyKey } });
      if (dup) return;

      await topupCredits({
        ref: { ownerType: "USER", ownerId: attribution.referrerUserId },
        credits,
        refType: "share_reward",
        idempotencyKey: `share_reward_topup:${inviteeUserId}`,
        description:
          attribution.channel === "WORKFLOW"
            ? `工作流分享奖励（好友完成首次生成并首笔付费）`
            : `邀请分享奖励（好友注册并首笔付费）`,
        source: "FREE",
        expiresAt,
      });

      await tx.shareRewardGrant.create({
        data: {
          inviteeUserId,
          referrerUserId: attribution.referrerUserId,
          channel: attribution.channel,
          credits,
          idempotencyKey,
        },
      });

      if (attribution.workflowClaimId) {
        await tx.workflowShareClaim.updateMany({
          where: { id: attribution.workflowClaimId },
          data: { rewardGrantedAt: new Date() },
        });
      }
    });
    return true;
  } catch (e) {
    console.warn("[share-reward] grant failed", inviteeUserId, e);
    return false;
  }
}

/** 分享人仪表盘：已获积分合计 */
export async function sumShareRewardCreditsGranted(referrerUserId: string): Promise<number> {
  const agg = await prisma.shareRewardGrant.aggregate({
    where: { referrerUserId },
    _sum: { credits: true },
  });
  return agg._sum.credits ?? 0;
}

/** 待完成：已归因但未发奖的下线数 */
export async function countPendingShareRewards(referrerUserId: string): Promise<number> {
  const attributions = await prisma.shareRewardAttribution.findMany({
    where: { referrerUserId },
    select: { inviteeUserId: true },
  });
  if (attributions.length === 0) return 0;

  const inviteeIds = attributions.map((a) => a.inviteeUserId);
  const granted = await prisma.shareRewardGrant.findMany({
    where: { inviteeUserId: { in: inviteeIds } },
    select: { inviteeUserId: true },
  });
  const grantedSet = new Set(granted.map((g) => g.inviteeUserId));
  return inviteeIds.filter((id) => !grantedSet.has(id)).length;
}
