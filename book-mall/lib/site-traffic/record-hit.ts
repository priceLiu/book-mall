import { prisma } from "@/lib/prisma";
import type { PlatformTrafficAppKey } from "@/lib/site-traffic/app-keys";
import { cstDateKey } from "@/lib/site-traffic/cst-date";

export type RecordTrafficHitInput = {
  appKey: PlatformTrafficAppKey;
  ip: string;
  userId?: string | null;
  at?: Date;
  /** 扫描/探测路径：仍计入 PV，同时累加 probe 计数 */
  isProbe?: boolean;
};

export async function recordTrafficHit(input: RecordTrafficHitInput): Promise<void> {
  const ip = input.ip.trim().slice(0, 45);
  if (!ip) return;

  const at = input.at ?? new Date();
  const dateCst = cstDateKey(at);
  const userId = input.userId?.trim() || null;
  const isProbe = Boolean(input.isProbe);

  await prisma.$transaction(
    async (tx) => {
      await tx.siteTrafficDaily.upsert({
        where: { dateCst_appKey: { dateCst, appKey: input.appKey } },
        create: {
          dateCst,
          appKey: input.appKey,
          pageViews: 1,
          probeViews: isProbe ? 1 : 0,
        },
        update: {
          pageViews: { increment: 1 },
          ...(isProbe ? { probeViews: { increment: 1 } } : {}),
        },
      });

      await tx.siteTrafficIpDaily.upsert({
        where: { dateCst_appKey_ip: { dateCst, appKey: input.appKey, ip } },
        create: {
          dateCst,
          appKey: input.appKey,
          ip,
          hitCount: 1,
          probeHitCount: isProbe ? 1 : 0,
          firstSeenAt: at,
          lastSeenAt: at,
          userId,
        },
        update: {
          hitCount: { increment: 1 },
          lastSeenAt: at,
          ...(isProbe ? { probeHitCount: { increment: 1 } } : {}),
        },
      });

      if (userId) {
        await tx.siteTrafficIpDaily.updateMany({
          where: {
            dateCst,
            appKey: input.appKey,
            ip,
            userId: null,
          },
          data: { userId },
        });
      }
    },
    { timeout: 15_000 },
  );
}
