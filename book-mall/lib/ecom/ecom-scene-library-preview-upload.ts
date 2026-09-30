import { uploadEcomSceneLibraryPreview } from "@/lib/canvas/canvas-oss";
import { generateAndUploadCatalogThumb } from "@/lib/ecom/ecom-catalog-thumb-upload";
import {
  getSceneLibraryEntry,
  upsertSceneLibraryEntry,
  type EcomSceneLibraryEntry,
} from "@/lib/ecom/ecom-scene-library-service";
import { assertUserCatalogEditable } from "@/lib/ecom/ecom-catalog-lock";

export async function uploadSceneLibraryEntryPreview(args: {
  id: string;
  actorUserId: string;
  allowPlatform?: boolean;
  buf: Buffer;
  contentType: string;
  ext: string;
}): Promise<EcomSceneLibraryEntry> {
  const existing = await getSceneLibraryEntry(args.id);
  if (!existing) throw new Error("条目不存在");

  if (existing.scope === "user") {
    await assertUserCatalogEditable("scene", args.id, args.actorUserId);
  } else if (existing.scope === "platform") {
    if (!args.allowPlatform) throw new Error("无权修改平台条目");
  }

  const ossUrl = await uploadEcomSceneLibraryPreview({
    id: args.id,
    buf: args.buf,
    contentType: args.contentType,
    ext: args.ext,
  });
  const thumbUrl = await generateAndUploadCatalogThumb({
    catalogKind: "scene",
    id: args.id,
    sourceBuf: args.buf,
  });

  return upsertSceneLibraryEntry({
    ...existing,
    ossUrl,
    thumbUrl,
  });
}

export async function clearSceneLibraryEntryPreview(args: {
  id: string;
  actorUserId: string;
  allowPlatform?: boolean;
}): Promise<EcomSceneLibraryEntry> {
  const existing = await getSceneLibraryEntry(args.id);
  if (!existing) throw new Error("条目不存在");

  if (existing.scope === "user") {
    await assertUserCatalogEditable("scene", args.id, args.actorUserId);
  } else if (existing.scope === "platform") {
    if (!args.allowPlatform) throw new Error("无权修改平台条目");
  }

  return upsertSceneLibraryEntry({
    ...existing,
    ossUrl: null,
    thumbUrl: null,
  });
}
