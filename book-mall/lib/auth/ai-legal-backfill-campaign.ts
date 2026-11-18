import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 120_000;
let cachedActive: boolean | null = null;
let cachedAt = 0;

export function invalidateAiLegalBackfillCampaignCache(): void {
  cachedActive = null;
  cachedAt = 0;
}

const pendingUserWhere = {
  OR: [
    { aiUserAgreementAcceptedAt: null },
    { aiAppPermissionsAcceptedAt: null },
    { aiPrivacyPolicyAcceptedAt: null },
  ],
} as const;

/** 是否仍需存量补签战役（false = 库内无人缺三份时间戳，Gate/JWT 可跳过法律列） */
export async function resolveAiLegalBackfillCampaignActive(): Promise<boolean> {
  const now = Date.now();
  if (cachedActive !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedActive;
  }

  try {
    const row = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: { aiLegalLegacyBackfillActive: true },
    });
    if (row?.aiLegalLegacyBackfillActive === false) {
      cachedActive = false;
      cachedAt = now;
      return false;
    }
  } catch {
    /* 读配置失败时保守视为战役仍在进行 */
    return true;
  }

  return refreshAiLegalBackfillCampaignFromDb();
}

/** 统计待补签用户；若为 0 则自动关闭战役并持久化到 PlatformConfig */
export async function refreshAiLegalBackfillCampaignFromDb(): Promise<boolean> {
  const now = Date.now();
  try {
    const pending = await prisma.user.count({ where: pendingUserWhere });
    if (pending === 0) {
      await prisma.platformConfig.upsert({
        where: { id: "default" },
        create: { id: "default", aiLegalLegacyBackfillActive: false },
        update: { aiLegalLegacyBackfillActive: false },
      });
      cachedActive = false;
      cachedAt = now;
      return false;
    }
    cachedActive = true;
    cachedAt = now;
    return true;
  } catch {
    cachedActive = true;
    cachedAt = now;
    return true;
  }
}