import { extractManagedOssObjectKey } from "@/lib/oss-delete-object";
import { readOssEnv } from "@/lib/oss-client";
import {
  pickPersistableProjectThumbnailUrl,
  pickProjectThumbnailUrl,
} from "./pick-project-thumbnail";

function isTrustworthyStoredThumbnail(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const cfg = readOssEnv();
  if ("error" in cfg) {
    return /myqcloud\.com/i.test(trimmed) || /aliyuncs\.com/i.test(trimmed);
  }
  return extractManagedOssObjectKey(trimmed, cfg) !== null;
}

/** 列表封面：与 canvas-project-service.resolveThumbnailUrl 一致 */
export function resolveListThumbnailUrl(args: {
  storedUrl?: string | null;
  canvas: unknown;
}): string {
  const stored = args.storedUrl?.trim() ?? "";
  const persistable = pickPersistableProjectThumbnailUrl(args.canvas);

  if (persistable && (!stored || !isTrustworthyStoredThumbnail(stored))) {
    return persistable;
  }
  if (stored) return stored;
  return pickProjectThumbnailUrl(args.canvas);
}
