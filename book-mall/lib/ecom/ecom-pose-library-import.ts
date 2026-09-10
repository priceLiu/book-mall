import { randomUUID } from "crypto";

import { uploadEcomPoseLibraryPreview } from "@/lib/canvas/canvas-oss";
import { generateAndUploadCatalogThumb } from "@/lib/ecom/ecom-catalog-thumb-upload";
import { findCatalogDuplicateByImageUrl } from "@/lib/ecom/ecom-catalog-import-dedup";
import {
  buildAutoPoseTitle,
  buildPoseSourceImageKeyFromBuffer,
  buildPoseSourceImageKeyFromUrl,
  extractPoseDescriptionFromPrompt,
  nextPlatformPoseId,
  normalizePoseSourceImageUrl,
} from "@/lib/ecom/ecom-pose-library-import-helpers";
import {
  normalizePoseGenders,
  normalizePoseSceneTags,
  type EcomPoseGender,
} from "@/lib/ecom/ecom-pose-library-meta";
import {
  findPoseEntryByNormalizedSourceUrl,
  findPoseEntryBySourceImageKey,
  getPoseLibraryEntry,
  upsertPoseLibraryEntry,
  type EcomPoseLibraryEntry,
} from "@/lib/ecom/ecom-pose-library-service";

export type ImportPoseFromImageInput = {
  imageUrl: string;
  savePrompt: boolean;
  prompt?: string;
  category?: string;
  genders?: EcomPoseGender[];
  sceneTags?: string[];
  sourceModule?: string;
  sourceAssetId?: string;
  adminUserId?: string;
  actorUserId: string;
  scope?: "platform" | "user" | "team";
  tenantId?: string | null;
};

export type ImportPoseFromImageResult =
  | { ok: true; entry: EcomPoseLibraryEntry; created: true }
  | {
      ok: false;
      duplicate: true;
      existingId: string;
      existingTitle: string;
    };

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const res = await fetch(url.trim());
  if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext =
    contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("图片内容为空");
  return { buf, contentType, ext };
}

export async function importPoseFromImage(
  input: ImportPoseFromImageInput,
): Promise<ImportPoseFromImageResult> {
  const imageUrl = input.imageUrl?.trim();
  if (!imageUrl) throw new Error("imageUrl 必填");

  const catalogDup = await findCatalogDuplicateByImageUrl(imageUrl);
  if (catalogDup) {
    return {
      ok: false,
      duplicate: true,
      existingId: catalogDup.existingId,
      existingTitle: catalogDup.existingTitle,
    };
  }

  const existingByUrl = await findPoseEntryByNormalizedSourceUrl(imageUrl);
  if (existingByUrl) {
    return {
      ok: false,
      duplicate: true,
      existingId: existingByUrl.id,
      existingTitle: existingByUrl.title,
    };
  }

  const { buf, contentType, ext } = await fetchImageBuffer(imageUrl);
  const hashKey = buildPoseSourceImageKeyFromBuffer(buf);
  const existingByHash = await findPoseEntryBySourceImageKey(hashKey);
  if (existingByHash) {
    return {
      ok: false,
      duplicate: true,
      existingId: existingByHash.id,
      existingTitle: existingByHash.title,
    };
  }

  const category = (input.category?.trim() || "A").toUpperCase();
  const genders = normalizePoseGenders(input.genders ?? ["unisex"]);
  const sceneTags = normalizePoseSceneTags(input.sceneTags ?? ["电商"]);
  const scope = input.scope ?? (input.adminUserId ? "platform" : "user");
  const id =
    scope === "platform"
      ? nextPlatformPoseId(category)
      : `user-pose-${randomUUID()}`;
  const ossUrl = await uploadEcomPoseLibraryPreview({ id, buf, contentType, ext });
  const thumbUrl = await generateAndUploadCatalogThumb({
    catalogKind: "pose",
    id,
    sourceBuf: buf,
  });

  const fullPrompt = input.savePrompt ? input.prompt?.trim() || "" : "";
  const poseDescription = input.savePrompt ? extractPoseDescriptionFromPrompt(fullPrompt) : "";
  const title = buildAutoPoseTitle({ savePrompt: input.savePrompt, poseDescription });

  const entry = await upsertPoseLibraryEntry({
    id,
    category,
    title,
    baseDescription: poseDescription || title,
    genders,
    sceneTags,
    ossUrl,
    thumbUrl,
    sourceImageKey: hashKey,
    tags: {
      genders,
      sceneTags,
      fullPrompt: fullPrompt || undefined,
      sourceImageUrl: normalizePoseSourceImageUrl(imageUrl),
      sourceModule: input.sourceModule,
      sourceAssetId: input.sourceAssetId,
      importedByAdminId: input.adminUserId,
      importedByUserId: input.actorUserId,
      tenantId: input.tenantId ?? undefined,
      importedAt: new Date().toISOString(),
    },
    scope,
    userId: scope === "user" ? input.actorUserId : scope === "team" ? input.actorUserId : null,
    enabled: true,
    sortOrder: Date.now() % 100000,
  });

  return { ok: true, entry, created: true };
}

export async function resolvePoseRefUrl(poseId?: string | null): Promise<string | null> {
  if (!poseId?.trim()) return null;
  const entry = await getPoseLibraryEntry(poseId.trim());
  return entry?.ossUrl?.trim() || null;
}
