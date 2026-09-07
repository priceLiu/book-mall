/**
 * QuickReplica gallery 快照 · 读写与生成编排。
 */
import type { StaticSnapshotTrigger } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { buildQuickReplicaGallerySnapshot } from "@/lib/static-snapshots/build-quick-replica-gallery-snapshot";
import {
  cstDateKey,
  GENERATION_RUN_RETAIN_COUNT,
  previousCstDateKey,
  snapshotPruneCutoffDateKey,
} from "@/lib/static-snapshots/cst-date";
import {
  isQuickReplicaGallerySnapshotPayload,
  normalizeQuickReplicaGallerySnapshotPayload,
  QUICK_REPLICA_GALLERY_PAGE_KEY,
  summarizeQuickReplicaGalleryPayload,
  type QuickReplicaGallerySnapshotPayload,
} from "@/lib/static-snapshots/quick-replica-gallery-payload";

export { QUICK_REPLICA_GALLERY_PAGE_KEY };

export type QuickReplicaGallerySnapshotReadResult = {
  payload: QuickReplicaGallerySnapshotPayload;
  dateKey: string;
  stale: boolean;
  source: "snapshot" | "fallback";
};

async function readReadySnapshot(
  dateKey: string,
): Promise<QuickReplicaGallerySnapshotPayload | null> {
  const row = await prisma.staticPageSnapshot.findUnique({
    where: {
      pageKey_dateKey: { pageKey: QUICK_REPLICA_GALLERY_PAGE_KEY, dateKey },
    },
    select: { status: true, payload: true },
  });
  if (!row || row.status !== "READY") return null;
  if (!isQuickReplicaGallerySnapshotPayload(row.payload)) return null;
  return normalizeQuickReplicaGallerySnapshotPayload(row.payload);
}

export async function getPublicQuickReplicaGallerySnapshot(
  dateKey?: string,
): Promise<QuickReplicaGallerySnapshotReadResult | null> {
  const key = dateKey ?? cstDateKey();
  const payload = await readReadySnapshot(key);
  if (payload) {
    return { payload, dateKey: key, stale: false, source: "snapshot" };
  }
  const prev = await readReadySnapshot(previousCstDateKey(key));
  if (prev) {
    return {
      payload: prev,
      dateKey: previousCstDateKey(key),
      stale: true,
      source: "snapshot",
    };
  }
  return null;
}

const fetchLiveGalleryCached = unstable_cache(
  async () => buildQuickReplicaGallerySnapshot(),
  ["quick-replica-gallery-live-fallback"],
  { revalidate: 300, tags: ["quick-replica-gallery-snapshot"] },
);

/** Platform API：优先读快照，无快照时短缓存 live build（降级） */
export async function getQuickReplicaGallerySnapshotForApi(
  now: Date = new Date(),
): Promise<QuickReplicaGallerySnapshotReadResult> {
  const today = cstDateKey(now);
  const cached = unstable_cache(
    async () => {
      const fromDb = await getPublicQuickReplicaGallerySnapshot(today);
      if (fromDb) return fromDb;
      const payload = await fetchLiveGalleryCached();
      return {
        payload,
        dateKey: today,
        stale: true,
        source: "fallback" as const,
      };
    },
    [`quick-replica-gallery-api-${today}`],
    { revalidate: 300, tags: ["quick-replica-gallery-snapshot"] },
  );
  return cached();
}

async function pruneOldSnapshots(now: Date) {
  const pageKey = QUICK_REPLICA_GALLERY_PAGE_KEY;
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

export async function runQuickReplicaGallerySnapshotGeneration(input: {
  trigger: StaticSnapshotTrigger;
  triggeredByUserId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = cstDateKey(now);
  const startedAt = now;
  const pageKey = QUICK_REPLICA_GALLERY_PAGE_KEY;

  const run = await prisma.staticSnapshotGenerationRun.create({
    data: {
      pageKey,
      dateKey,
      status: "FAILED",
      trigger: input.trigger,
      triggeredByUserId: input.triggeredByUserId ?? null,
      startedAt,
    },
  });

  try {
    const payload = await buildQuickReplicaGallerySnapshot(now);
    const summary = summarizeQuickReplicaGalleryPayload(payload);
    const finishedAt = new Date();

    await prisma.$transaction([
      prisma.staticPageSnapshot.upsert({
        where: { pageKey_dateKey: { pageKey, dateKey } },
        create: {
          pageKey,
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

    await pruneOldSnapshots(now);
    try {
      revalidatePath("/api/public/static-snapshots/quick-replica-gallery");
      revalidateTag("quick-replica-gallery-snapshot");
    } catch {
      /* CLI 无 Next 上下文 */
    }

    const row = await prisma.staticPageSnapshot.findUniqueOrThrow({
      where: { pageKey_dateKey: { pageKey, dateKey } },
    });
    return { dateKey, summary, snapshot: row };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.staticSnapshotGenerationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message.slice(0, 2000),
      },
    });
    throw err;
  }
}
