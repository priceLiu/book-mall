/**
 * 新用户注册赠送积分（分享链接 1.0）
 *
 * - 通用池 + 视频专项池双池发放，长期有效、不清零（见需求 5）。
 * - 额度落 PlatformPricingConfig（welcomeGiftGeneralCredits / welcomeGiftVideoCredits），
 *   财务可调；缺省 500 通用 + 100 视频。
 * - 幂等：按 userId 生成幂等键，重复注册回放不重复发放。
 */
import { prisma } from "@/lib/prisma";

import { topupCredits } from "./credit-account-service";

export const WELCOME_GIFT_GENERAL_FALLBACK = 500;
export const WELCOME_GIFT_VIDEO_FALLBACK = 100;

export interface WelcomeGiftConfig {
  generalCredits: number;
  videoCredits: number;
}

/** 读取注册赠送配置（DB 无配置或异常时回退默认）。 */
export async function getWelcomeGiftConfig(): Promise<WelcomeGiftConfig> {
  try {
    const cfg = await prisma.platformPricingConfig.findUnique({
      where: { id: "default" },
      select: { welcomeGiftGeneralCredits: true, welcomeGiftVideoCredits: true },
    });
    const general = cfg?.welcomeGiftGeneralCredits ?? WELCOME_GIFT_GENERAL_FALLBACK;
    const video = cfg?.welcomeGiftVideoCredits ?? WELCOME_GIFT_VIDEO_FALLBACK;
    return {
      generalCredits: Math.max(0, Math.round(general)),
      videoCredits: Math.max(0, Math.round(video)),
    };
  } catch {
    return {
      generalCredits: WELCOME_GIFT_GENERAL_FALLBACK,
      videoCredits: WELCOME_GIFT_VIDEO_FALLBACK,
    };
  }
}

/**
 * 给新注册用户发放赠送积分（幂等）。发放失败不应阻断注册主流程，调用方需吞掉异常并记日志。
 */
export async function grantWelcomeGift(userId: string): Promise<void> {
  const { generalCredits, videoCredits } = await getWelcomeGiftConfig();
  const ref = { ownerType: "USER" as const, ownerId: userId };

  if (generalCredits > 0) {
    await topupCredits({
      ref,
      credits: generalCredits,
      pool: "GENERAL",
      refType: "welcome_gift",
      idempotencyKey: `welcome_gift:general:${userId}`,
      description: "新用户注册赠送积分（通用池）",
    });
  }
  if (videoCredits > 0) {
    await topupCredits({
      ref,
      credits: videoCredits,
      pool: "VIDEO",
      refType: "welcome_gift",
      idempotencyKey: `welcome_gift:video:${userId}`,
      description: "新用户注册赠送积分（视频池）",
    });
  }
}
