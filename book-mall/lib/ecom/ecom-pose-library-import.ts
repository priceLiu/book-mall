import {
  uploadEcomPoseLibraryPreview,
} from "@/lib/canvas/canvas-oss";
import {
  buildAutoPoseTitle,
  buildPoseSourceImageKeyFromBuffer,
  buildPoseSourceImageKeyFromUrl,
  extractPoseDescriptionFromPrompt,
  nextPlatformPoseId,
  normalizePoseSourceImageUrl,
} from "@/lib/ecom/ecom-pose-library-import-helpers";
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
  sourceModule?: string;
  sourceAssetId?: string;
  adminUserId: string;
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
  const id = nextPlatformPoseId(category);
  const ossUrl = await uploadEcomPoseLibraryPreview({ id, buf, contentType, ext });

  const fullPrompt = input.savePrompt ? input.prompt?.trim() || "" : "";
  const poseDescription = input.savePrompt ? extractPoseDescriptionFromPrompt(fullPrompt) : "";
  const title = buildAutoPoseTitle({ savePrompt: input.savePrompt, poseDescription });

  const entry = await upsertPoseLibraryEntry({
    id,
    category,
    title,
    baseDescription: poseDescription,
    ossUrl,
    thumbUrl: ossUrl,
    sourceImageKey: hashKey,
    tags: {
      fullPrompt: fullPrompt || undefined,
      sourceImageUrl: normalizePoseSourceImageUrl(imageUrl),
      sourceModule: input.sourceModule,
      sourceAssetId: input.sourceAssetId,
      importedByAdminId: input.adminUserId,
      importedAt: new Date().toISOString(),
    },
    scope: "platform",
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
