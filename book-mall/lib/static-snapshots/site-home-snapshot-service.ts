/**
 * 首页静态快照 · 读写与生成编排。
 */
import type { StaticSnapshotTrigger } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  buildSiteHomeSnapshot,
  buildSiteHomeSnapshotFallback,
} from "@/lib/static-snapshots/build-site-home-snapshot";
import {
  cstDateKey,
  GENERATION_RUN_RETAIN_COUNT,
  previousCstDateKey,
  snapshotPruneCutoffDateKey,
} from "@/lib/static-snapshots/cst-date";
import {
  isSiteHomeSnapshotPayload,
  normalizeSiteHomeSnapshotPayload,
  SITE_HOME_PAGE_KEY,
  summarizeSiteHomePayload,
  type SiteHomeSnapshotPayload,
} from "@/lib/static-snapshots/site-home-payload";

export { SITE_HOME_PAGE_KEY };

export type SiteHomeSnapshotReadResult = {
  payload: SiteHomeSnapshotPayload;
  dateKey: string;
  stale: boolean;
  source: "snapshot" | "fallback";
};

async function readReadySnapshot(
  pageKey: string,
  dateKey: string,
): Promise<SiteHomeSnapshotPayload | null> {
  const row = await prisma.staticPageSnapshot.findUnique({
    where: { pageKey_dateKey: { pageKey, dateKey } },
    select: { status: true, payload: true },
  });
  if (!row || row.status !== "READY") return null;
  if (!isSiteHomeSnapshotPayload(row.payload)) return null;
  return normalizeSiteHomeSnapshotPayload(row.payload);
}

export async function getSiteHomeSnapshotForRender(
  now: Date = new Date(),
): Promise<SiteHomeSnapshotReadResult> {
  const today = cstDateKey(now);
  const cached = unstable_cache(
    async () => {
      const todayPayload = await readReadySnapshot(SITE_HOME_PAGE_KEY, today);
      if (todayPayload) {
        return { payload: todayPayload, dateKey: today, stale: false, source: "snapshot" as const };
      }
      const yesterday = previousCstDateKey(today);
      const yesterdayPayload = await readReadySnapshot(SITE_HOME_PAGE_KEY, yesterday);
      if (yesterdayPayload) {
        return {
          payload: yesterdayPayload,
          dateKey: yesterday,
          stale: true,
          source: "snapshot" as const,
        };
      }
      return {
        payload: normalizeSiteHomeSnapshotPayload(buildSiteHomeSnapshotFallback(today)),
        dateKey: today,
        stale: true,
        source: "fallback" as const,
      };
    },
    [`site-home-snapshot-${today}`],
    { revalidate: 3600, tags: ["site-home-snapshot"] },
  );
  return cached();
}

export async function getPublicSiteHomeSnapshot(
  dateKey?: string,
): Promise<SiteHomeSnapshotReadResult> {
  const key = dateKey ?? cstDateKey();
  const payload = await readReadySnapshot(SITE_HOME_PAGE_KEY, key);
  if (payload) {
    return { payload, dateKey: key, stale: false, source: "snapshot" };
  }
  const prev = await readReadySnapshot(SITE_HOME_PAGE_KEY, previousCstDateKey(key));
  if (prev) {
    return { payload: prev, dateKey: previousCstDateKey(key), stale: true, source: "snapshot" };
  }
  return {
    payload: normalizeSiteHomeSnapshotPayload(buildSiteHomeSnapshotFallback(key)),
    dateKey: key,
    stale: true,
    source: "fallback",
  };
}

async function pruneOldSnapshots(pageKey: string, now: Date) {
  const cutoff = snapshotPruneCutoffDateKey(now);
  await prisma.staticPageSnapshot.deleteMany({
    where: { pageKey, dateKey: { lt: cutoff } },
  });

  const runs = await prisma.staticSnapshotGenerationRun.findMany({
    where: { pageKey },
    orderBy: { startedAt: "desc" },
    select: { id: true },
    skip: GENERATION_RUN_RETAIN_COUNT,
  });
  if (runs.length > 0) {
    await prisma.staticSnapshotGenerationRun.deleteMany({
      where: { id: { in: runs.map((r) => r.id) } },
    });
  }
}

export async function runSiteHomeSnapshotGeneration(input: {
  trigger: StaticSnapshotTrigger;
  triggeredByUserId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = cstDateKey(now);
  const startedAt = now;

  const run = await prisma.staticSnapshotGenerationRun.create({
    data: {
      pageKey: SITE_HOME_PAGE_KEY,
      dateKey,
      status: "FAILED",
      trigger: input.trigger,
      triggeredByUserId: input.triggeredByUserId ?? null,
      startedAt,
    },
  });

  try {
    const payload = await buildSiteHomeSnapshot(dateKey);
    const summary = summarizeSiteHomePayload(payload);
    const finishedAt = new Date();

    await prisma.$transaction([
      prisma.staticPageSnapshot.upsert({
        where: { pageKey_dateKey: { pageKey: SITE_HOME_PAGE_KEY, dateKey } },
        create: {
          pageKey: SITE_HOME_PAGE_KEY,
          dateKey,
          status: "READY",
          payload: payload as object,
          generatedAt: finishedAt,
        },
        update: {
          status: "READY",
          payload: payload as object,
          errorMessage: null,
          generatedAt: finishedAt,
        },
      }),
      prisma.staticSnapshotGenerationRun.update({
        where: { id: run.id },
        data: {
          status: "READY",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          summary: summary as object,
          errorMessage: null,
        },
      }),
    ]);

    await pruneOldSnapshots(SITE_HOME_PAGE_KEY, now);
    try {
      revalidatePath("/");
      revalidatePath("/api/public/static-snapshots/site-home");
    } catch {
      // CLI 脚本无 Next 静态生成上下文，跳过 ISR 刷新
    }

    const row = await prisma.staticPageSnapshot.findUniqueOrThrow({
      where: { pageKey_dateKey: { pageKey: SITE_HOME_PAGE_KEY, dateKey } },
    });

    return { dateKey, payload, summary, snapshot: row, runId: run.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const finishedAt = new Date();
    await prisma.staticSnapshotGenerationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: msg.slice(0, 4000),
      },
    });
    await prisma.staticPageSnapshot.upsert({
      where: { pageKey_dateKey: { pageKey: SITE_HOME_PAGE_KEY, dateKey } },
      create: {
        pageKey: SITE_HOME_PAGE_KEY,
        dateKey,
        status: "FAILED",
        payload: buildSiteHomeSnapshotFallback(dateKey) as object,
        errorMessage: msg.slice(0, 4000),
      },
      update: {
        status: "FAILED",
        errorMessage: msg.slice(0, 4000),
      },
    });
    throw e;
  }
}

export async function listStaticSnapshotGenerationRuns(pageKey: string, limit = 30) {
  return prisma.staticSnapshotGenerationRun.findMany({
    where: { pageKey },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      pageKey: true,
      dateKey: true,
      status: true,
      trigger: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      errorMessage: true,
      summary: true,
      triggeredByUserId: true,
    },
  });
}

export async function getLatestStaticPageSnapshot(pageKey: string) {
  return prisma.staticPageSnapshot.findFirst({
    where: { pageKey },
    orderBy: { dateKey: "desc" },
    select: {
      pageKey: true,
      dateKey: true,
      status: true,
      generatedAt: true,
      errorMessage: true,
      payload: true,
    },
  });
}
