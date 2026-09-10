import { randomUUID } from "crypto";

import {
  uploadEcomModelLibraryPreview,
  uploadEcomPoseLibraryPreview,
} from "@/lib/canvas/canvas-oss";
import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { findCatalogDuplicateByImageUrl } from "@/lib/ecom/ecom-catalog-import-dedup";
import { createFullBodyModelFromImport } from "@/lib/ecom/ecom-full-body-model-library-service";
import { createGarmentFromImport } from "@/lib/ecom/ecom-garment-library-service";
import type { GlobalAssetCatalogKind } from "@/lib/ecom/ecom-global-asset-catalog";
import { generateAndUploadCatalogThumb } from "@/lib/ecom/ecom-catalog-thumb-upload";
import { buildPoseSourceImageKeyFromBuffer } from "@/lib/ecom/ecom-pose-library-import-helpers";
import { importPoseFromImage } from "@/lib/ecom/ecom-pose-library-import";
import type { EcomPoseGender } from "@/lib/ecom/ecom-pose-library-meta";
import { upsertModelLibraryEntry } from "@/lib/ecom/ecom-model-library-service";
import { prisma } from "@/lib/prisma";

export type CatalogImportFromImageInput = {
  catalogKind: GlobalAssetCatalogKind;
  imageUrl: string;
  actorUserId: string;
  isPlatformAdmin?: boolean;
  scope?: EcomCatalogScope;
  tenantId?: string | null;
  name?: string;
  gender?: "female" | "male";
  savePrompt?: boolean;
  prompt?: string;
  category?: string;
  genders?: EcomPoseGender[];
  sceneTags?: string[];
  sourceModule?: string;
  sourceAssetId?: string;
};

async function fetchImageBuffer(
  url: string,
): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const res = await fetch(url.trim());
  if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext =
    contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("图片内容为空");
  return { buf, contentType, ext };
}

function resolveScope(
  input: CatalogImportFromImageInput,
): EcomCatalogScope {
  if (input.scope) {
    if (input.scope === "platform" && !input.isPlatformAdmin) {
      throw new Error("仅平台管理员可设为全平台");
    }
    if (input.scope === "team") {
      throw new Error("团队可见暂未开放");
    }
    return input.scope;
  }
  return input.isPlatformAdmin ? "platform" : "user";
}

export async function importCatalogFromImage(input: CatalogImportFromImageInput) {
  const scope = resolveScope(input);
  const gender = input.gender === "male" ? "male" : "female";

  const duplicateByUrl = await findCatalogDuplicateByImageUrl(input.imageUrl);
  if (duplicateByUrl) {
    return {
      ok: false as const,
      duplicate: true,
      existingId: duplicateByUrl.existingId,
      existingTitle: duplicateByUrl.existingTitle,
    };
  }

  if (input.catalogKind === "pose") {
    const result = await importPoseFromImage({
      imageUrl: input.imageUrl,
      savePrompt: input.savePrompt === true,
      prompt: input.prompt,
      category: input.category,
      genders: input.genders,
      sceneTags: input.sceneTags,
      sourceModule: input.sourceModule,
      sourceAssetId: input.sourceAssetId,
      adminUserId: input.isPlatformAdmin ? input.actorUserId : undefined,
      actorUserId: input.actorUserId,
      scope,
      tenantId: input.tenantId,
    });
    if (!result.ok) {
      return {
        ok: false as const,
        duplicate: true,
        existingId: result.existingId,
        existingTitle: result.existingTitle,
      };
    }
    return { ok: true as const, catalogKind: "pose" as const, entry: result.entry };
  }

  const { buf, contentType, ext } = await fetchImageBuffer(input.imageUrl);
  const hashKey = buildPoseSourceImageKeyFromBuffer(buf);
  const defaultName = input.name?.trim() || `入库-${new Date().toISOString().slice(0, 10)}`;

  if (input.catalogKind === "avatar") {
    const id =
      scope === "platform"
        ? `avatar-${gender}-${randomUUID().slice(0, 8)}`
        : `user-avatar-${randomUUID()}`;
    const ossUrl = await uploadEcomModelLibraryPreview({ id, buf, contentType, ext });
    const thumbUrl = await generateAndUploadCatalogThumb({
      catalogKind: "avatar",
      id,
      sourceBuf: buf,
    });
    await upsertModelLibraryEntry({
      id,
      name: defaultName,
      gender: gender === "male" ? "male" : "female",
      age: "adult",
      ossUrl,
      sortOrder: Date.now() % 100000,
    });
    await prisma.ecomModelLibraryEntry.update({
      where: { id },
      data: {
        thumbUrl,
        scope,
        userId: scope === "platform" ? null : input.actorUserId,
        tenantId: scope === "team" ? input.tenantId ?? null : null,
        enabled: true,
      },
    });
    const entry = await prisma.ecomModelLibraryEntry.findFirst({ where: { id } });
    return { ok: true as const, catalogKind: "avatar" as const, entry };
  }

  if (input.catalogKind === "garment") {
    const id =
      scope === "platform"
        ? `garment-${gender}-${randomUUID().slice(0, 8)}`
        : `user-garment-${randomUUID()}`;
    const ossUrl = await uploadEcomPoseLibraryPreview({ id, buf, contentType, ext });
    const thumbUrl = await generateAndUploadCatalogThumb({
      catalogKind: "garment",
      id,
      sourceBuf: buf,
    });
    const entry = await createGarmentFromImport({
      name: defaultName,
      gender,
      ossUrl,
      thumbUrl,
      sourceImageKey: hashKey,
      scope,
      userId: input.actorUserId,
      tenantId: input.tenantId,
    });
    return { ok: true as const, catalogKind: "garment" as const, entry };
  }

  if (input.catalogKind === "full-body") {
    const id =
      scope === "platform"
        ? `fb-model-${gender}-${randomUUID().slice(0, 8)}`
        : `user-fb-model-${randomUUID()}`;
    const ossUrl = await uploadEcomModelLibraryPreview({ id, buf, contentType, ext });
    const thumbUrl = await generateAndUploadCatalogThumb({
      catalogKind: "full-body",
      id,
      sourceBuf: buf,
    });
    const entry = await createFullBodyModelFromImport({
      name: defaultName,
      gender,
      ossUrl,
      thumbUrl,
      sourceImageKey: hashKey,
      sourceAssetId: input.sourceAssetId,
      scope,
      userId: input.actorUserId,
      tenantId: input.tenantId,
    });
    return { ok: true as const, catalogKind: "full-body" as const, entry };
  }

  throw new Error("不支持的 catalogKind");
}
