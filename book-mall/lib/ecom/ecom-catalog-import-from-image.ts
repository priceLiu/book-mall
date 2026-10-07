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
import {
  analyzeSceneImageForCatalog,
  analyzeStyleImageForCatalog,
} from "@/lib/ecom/ecom-catalog-visual-analysis";
import { catalogScopePersistFields } from "@/lib/ecom/ecom-catalog-viewer-scope";
import { createStyleFromImport } from "@/lib/ecom/ecom-style-library-service";
import { upsertSceneLibraryEntry } from "@/lib/ecom/ecom-scene-library-service";
import {
  uploadEcomSceneLibraryPreview,
  uploadUserStyleLibraryPreview,
} from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";

export type CatalogImportFromImageInput = {
  catalogKind: GlobalAssetCatalogKind;
  imageUrl: string;
  actorUserId: string;
  isPlatformAdmin?: boolean;
  scope?: EcomCatalogScope;
  tenantId?: string | null;
  sourceProjectId?: string | null;
  preferredTenantId?: string | null;
  /** 画布 Gateway 视觉 modelKey（与图片反推一致） */
  modelKey?: string;
  /** 当前画布 projectId（Gateway clientPage / 日志，与 scope 无关） */
  canvasProjectId?: string;
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

function assertCanvasScopedCatalog(input: CatalogImportFromImageInput, scope: EcomCatalogScope) {
  if (scope !== "team" && scope !== "project") return;
  if (input.sourceModule !== "canvas") {
    throw new Error("团队/项目可见范围仅在画布中可选");
  }
  if (scope === "team") {
    const tenant = input.tenantId?.trim();
    if (!tenant) throw new Error("团队可见须指定 tenantId");
    const preferred = input.preferredTenantId?.trim();
    if (preferred && tenant !== preferred) {
      throw new Error("tenantId 与当前团队空间不一致");
    }
  }
  if (scope === "project" && !input.sourceProjectId?.trim()) {
    throw new Error("项目可见须指定 sourceProjectId");
  }
}

function resolveScope(input: CatalogImportFromImageInput): EcomCatalogScope {
  const scope =
    input.scope ?? (input.isPlatformAdmin ? "platform" : "user");
  if (scope === "platform" && !input.isPlatformAdmin) {
    throw new Error("仅平台管理员可设为全平台");
  }
  assertCanvasScopedCatalog(input, scope);
  return scope;
}

function scopeFields(input: CatalogImportFromImageInput, scope: EcomCatalogScope) {
  return catalogScopePersistFields(scope, {
    actorUserId: input.actorUserId,
    tenantId: input.tenantId,
    sourceProjectId: input.sourceProjectId,
  });
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
      sourceProjectId: input.sourceProjectId,
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
        ...scopeFields(input, scope),
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
      sourceProjectId: input.sourceProjectId,
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
      sourceProjectId: input.sourceProjectId,
    });
    return { ok: true as const, catalogKind: "full-body" as const, entry };
  }

  if (input.catalogKind === "style") {
    const analysis = await analyzeStyleImageForCatalog({
      userId: input.actorUserId,
      imageUrl: input.imageUrl,
      modelKey: input.modelKey,
      projectId: input.canvasProjectId ?? input.sourceProjectId,
      sourceModule: input.sourceModule,
    });
    const id =
      scope === "platform"
        ? `style-${randomUUID().slice(0, 8)}`
        : `user-style-${randomUUID()}`;
    const ossUrl = await uploadUserStyleLibraryPreview({ id, buf, contentType, ext });
    const thumbUrl = await generateAndUploadCatalogThumb({
      catalogKind: "style",
      id,
      sourceBuf: buf,
    });
    const fields = scopeFields(input, scope);
    const entry = await createStyleFromImport({
      name: defaultName,
      stylePrompt: analysis.stylePrompt,
      ossUrl,
      thumbUrl,
      sourceImageKey: hashKey,
      tags: analysis.tags,
      scope: fields.scope,
      userId: input.actorUserId,
      tenantId: fields.tenantId,
      sourceProjectId: fields.sourceProjectId,
    });
    return { ok: true as const, catalogKind: "style" as const, entry };
  }

  if (input.catalogKind === "scene") {
    const analysis = await analyzeSceneImageForCatalog({
      userId: input.actorUserId,
      imageUrl: input.imageUrl,
      modelKey: input.modelKey,
      projectId: input.canvasProjectId ?? input.sourceProjectId,
      sourceModule: input.sourceModule,
    });
    const id =
      scope === "platform"
        ? `scene-${randomUUID().slice(0, 8)}`
        : `user-scene-${randomUUID()}`;
    const ossUrl = await uploadEcomSceneLibraryPreview({ id, buf, contentType, ext });
    const thumbUrl = await generateAndUploadCatalogThumb({
      catalogKind: "scene",
      id,
      sourceBuf: buf,
    });
    const fields = scopeFields(input, scope);
    const entry = await upsertSceneLibraryEntry({
      id,
      name: defaultName,
      visualPrompt: analysis.visualPrompt,
      ossUrl,
      thumbUrl,
      sourceImageKey: hashKey,
      tags: analysis.tags,
      scope: fields.scope,
      userId: fields.userId ?? input.actorUserId,
      tenantId: fields.tenantId,
      sourceProjectId: fields.sourceProjectId,
      sortOrder: Date.now() % 100000,
    });
    return { ok: true as const, catalogKind: "scene" as const, entry };
  }

  throw new Error("不支持的 catalogKind");
}
