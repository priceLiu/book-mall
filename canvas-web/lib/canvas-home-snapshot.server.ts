/**
 * 画布门户首页 · 从 book-mall 读取静态快照（服务端）。
 */
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { getBookMallOrigin } from "@/lib/site-config";
import {
  isCanvasHomeSnapshotPayload,
  type CanvasHomeSnapshotFetchResult,
} from "@/lib/canvas-home-snapshot-types";

export type { CanvasHomeSnapshotPayload, CanvasHomeSnapshotFetchResult } from "@/lib/canvas-home-snapshot-types";

export async function fetchCanvasHomeSnapshotServer(): Promise<CanvasHomeSnapshotFetchResult | null> {
  const base = getBookMallBaseUrlServer() || getBookMallOrigin();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/public/static-snapshots/canvas-home`, {
      next: { revalidate: 3600, tags: ["canvas-home-snapshot"] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      dateKey?: string;
      stale?: boolean;
      source?: "snapshot" | "fallback";
      payload?: unknown;
    };
    if (!isCanvasHomeSnapshotPayload(data.payload)) return null;
    return {
      dateKey: data.dateKey ?? "",
      stale: data.stale === true,
      source: data.source === "snapshot" ? "snapshot" : "fallback",
      payload: data.payload,
    };
  } catch {
    return null;
  }
}
