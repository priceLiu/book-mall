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

  await prisma.$transaction(async (tx) => {
    const daily = await tx.siteTrafficDaily.findUnique({
      where: { dateCst_appKey: { dateCst, appKey: input.appKey } },
      select: { id: true },
    });
    if (daily) {
      await tx.siteTrafficDaily.update({
        where: { id: daily.id },
        data: {
          pageViews: { increment: 1 },
          ...(isProbe ? { probeViews: { increment: 1 } } : {}),
        },
      });
    } else {
      await tx.siteTrafficDaily.create({
        data: {
          dateCst,
          appKey: input.appKey,
          pageViews: 1,
          probeViews: isProbe ? 1 : 0,
        },
      });
    }

    const ipRow = await tx.siteTrafficIpDaily.findUnique({
      where: { dateCst_appKey_ip: { dateCst, appKey: input.appKey, ip } },
      select: { id: true, userId: true },
    });
    if (ipRow) {
      await tx.siteTrafficIpDaily.update({
        where: { id: ipRow.id },
        data: {
          hitCount: { increment: 1 },
          lastSeenAt: at,
          ...(isProbe ? { probeHitCount: { increment: 1 } } : {}),
          ...(userId && !ipRow.userId ? { userId } : {}),
        },
      });
    } else {
      await tx.siteTrafficIpDaily.create({
        data: {
          dateCst,
          appKey: input.appKey,
          ip,
          hitCount: 1,
          probeHitCount: isProbe ? 1 : 0,
          firstSeenAt: at,
          lastSeenAt: at,
          userId,
        },
      });
    }
  });
}
