/**
 * 新用户注册赠送积分（分享链接 1.0 · 单池）
 */
import { prisma } from "@/lib/prisma";

import { topupCredits } from "./credit-account-service";

export const WELCOME_GIFT_GENERAL_FALLBACK = 600;

export interface WelcomeGiftConfig {
  generalCredits: number;
}

export async function getWelcomeGiftConfig(): Promise<WelcomeGiftConfig> {
  try {
    const cfg = await prisma.platformPricingConfig.findUnique({
      where: { id: "default" },
      select: { welcomeGiftGeneralCredits: true },
    });
    return {
      generalCredits: Math.max(0, Math.round(cfg?.welcomeGiftGeneralCredits ?? WELCOME_GIFT_GENERAL_FALLBACK)),
    };
  } catch {
    return { generalCredits: WELCOME_GIFT_GENERAL_FALLBACK };
  }
}

export async function grantWelcomeGift(userId: string): Promise<void> {
  const { generalCredits } = await getWelcomeGiftConfig();
  const ref = { ownerType: "USER" as const, ownerId: userId };

  if (generalCredits > 0) {
    await topupCredits({
      ref,
      credits: generalCredits,
      refType: "welcome_gift",
      idempotencyKey: `welcome_gift:${userId}`,
      description: "新用户注册赠送积分",
      source: "FREE",
    });
  }
}
