/**
 * 分享规则 2.0 · 配置读取
 */
import { prisma } from "@/lib/prisma";

export type ShareRewardConfig = {
  referralRewardCredits: number;
  workflowShareRewardCredits: number;
  shareRewardCreditsExpireDays: number;
  shareRewardDailyCapPerReferrer: number;
};

const FALLBACK: ShareRewardConfig = {
  referralRewardCredits: 20,
  workflowShareRewardCredits: 40,
  shareRewardCreditsExpireDays: 90,
  shareRewardDailyCapPerReferrer: 0,
};

export async function getShareRewardConfig(): Promise<ShareRewardConfig> {
  try {
    const cfg = await prisma.platformPricingConfig.findUnique({
      where: { id: "default" },
      select: {
        referralRewardCredits: true,
        workflowShareRewardCredits: true,
        shareRewardCreditsExpireDays: true,
        shareRewardDailyCapPerReferrer: true,
      },
    });
    if (!cfg) return FALLBACK;
    return {
      referralRewardCredits: Math.max(0, cfg.referralRewardCredits ?? FALLBACK.referralRewardCredits),
      workflowShareRewardCredits: Math.max(
        0,
        cfg.workflowShareRewardCredits ?? FALLBACK.workflowShareRewardCredits,
      ),
      shareRewardCreditsExpireDays: Math.max(
        1,
        cfg.shareRewardCreditsExpireDays ?? FALLBACK.shareRewardCreditsExpireDays,
      ),
      shareRewardDailyCapPerReferrer: Math.max(
        0,
        cfg.shareRewardDailyCapPerReferrer ?? 0,
      ),
    };
  } catch {
    return FALLBACK;
  }
}

/** 计入「首笔付费」的 Order.type */
export const QUALIFYING_FIRST_PAY_ORDER_TYPES = [
  "CREDIT_TOPUP",
  "SUBSCRIPTION",
  "MEMBERSHIP",
  "PRODUCT_SUBSCRIPTION",
] as const;
