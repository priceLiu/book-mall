/**
 * 静态页快照 · pageKey 注册与生成调度。
 */
import type { StaticSnapshotTrigger } from "@prisma/client";

import { runCanvasHomeSnapshotGeneration } from "@/lib/static-snapshots/canvas-home-snapshot-service";
import { CANVAS_HOME_PAGE_KEY } from "@/lib/static-snapshots/canvas-home-payload";
import { runSiteHomeSnapshotGeneration } from "@/lib/static-snapshots/site-home-snapshot-service";
import { SITE_HOME_PAGE_KEY } from "@/lib/static-snapshots/site-home-payload";

export const STATIC_SNAPSHOT_PAGE_KEYS = [SITE_HOME_PAGE_KEY, CANVAS_HOME_PAGE_KEY] as const;

export type StaticSnapshotPageKey = (typeof STATIC_SNAPSHOT_PAGE_KEYS)[number];

export function isStaticSnapshotPageKey(value: string): value is StaticSnapshotPageKey {
  return (STATIC_SNAPSHOT_PAGE_KEYS as readonly string[]).includes(value);
}

export async function runStaticSnapshotGeneration(input: {
  pageKey: StaticSnapshotPageKey;
  trigger: StaticSnapshotTrigger;
  triggeredByUserId?: string | null;
  now?: Date;
}) {
  switch (input.pageKey) {
    case SITE_HOME_PAGE_KEY:
      return runSiteHomeSnapshotGeneration(input);
    case CANVAS_HOME_PAGE_KEY:
      return runCanvasHomeSnapshotGeneration(input);
    default: {
      const _exhaustive: never = input.pageKey;
      throw new Error(`unsupported pageKey: ${_exhaustive}`);
    }
  }
}

/** Cron 默认：依次生成全部已注册 pageKey */
export async function runAllStaticSnapshotGenerations(input: {
  trigger: StaticSnapshotTrigger;
  triggeredByUserId?: string | null;
  now?: Date;
}) {
  const results = [];
  for (const pageKey of STATIC_SNAPSHOT_PAGE_KEYS) {
    results.push(await runStaticSnapshotGeneration({ ...input, pageKey }));
  }
  return results;
}
