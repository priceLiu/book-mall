import type { GlobalAssetCatalogKind } from "@/lib/ecom/ecom-global-asset-catalog";
import {
  catalogKindToGarmentKind,
  isCharacterCatalogKind,
  isGarmentBackedCatalogKind,
} from "@/lib/ecom/ecom-catalog-kind-meta";
import { normalizePoseSourceImageUrl } from "@/lib/ecom/ecom-pose-library-import-helpers";
import { findPoseEntryByNormalizedSourceUrl } from "@/lib/ecom/ecom-pose-library-service";
import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { prisma } from "@/lib/prisma";

export type CatalogDuplicateHit = {
  existingId: string;
  existingTitle: string;
};

export type CatalogDuplicateContext = {
  catalogKind: GlobalAssetCatalogKind;
  scope: EcomCatalogScope;
};

function norm(url: string): string {
  return normalizePoseSourceImageUrl(url);
}

function urlMatches(stored: string | null | undefined, target: string): boolean {
  if (!stored?.trim()) return false;
  return norm(stored) === target;
}

/** 同一图片 + 同一 catalog 类型 + 同一 scope 再次保存 → 409 */
export async function findCatalogDuplicateByImageUrl(
  imageUrl: string,
  ctx: CatalogDuplicateContext,
): Promise<CatalogDuplicateHit | null> {
  const target = norm(imageUrl);
  if (!target) return null;

  const { catalogKind, scope } = ctx;

  if (catalogKind === "pose") {
    const pose = await findPoseEntryByNormalizedSourceUrl(imageUrl);
    if (pose && (pose.scope ?? "platform") === scope) {
      return { existingId: pose.id, existingTitle: pose.title };
    }
    return null;
  }

  if (isGarmentBackedCatalogKind(catalogKind)) {
    const garmentKind = catalogKindToGarmentKind(catalogKind)!;
    const rows = await prisma.ecomGarmentLibraryEntry.findMany({
      where: {
        deletedAt: null,
        scope,
        garmentKind,
      },
      select: { id: true, name: true, ossUrl: true, thumbUrl: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      if (urlMatches(row.ossUrl, target) || urlMatches(row.thumbUrl, target)) {
        return { existingId: row.id, existingTitle: row.name };
      }
    }
    return null;
  }

  if (catalogKind === "full-body") {
    const rows = await prisma.ecomFullBodyModelEntry.findMany({
      where: { deletedAt: null, scope },
      select: { id: true, name: true, ossUrl: true, thumbUrl: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      if (urlMatches(row.ossUrl, target) || urlMatches(row.thumbUrl, target)) {
        return { existingId: row.id, existingTitle: row.name };
      }
    }
    return null;
  }

  if (catalogKind === "avatar" || isCharacterCatalogKind(catalogKind)) {
    const rows = await prisma.ecomModelLibraryEntry.findMany({
      where: { deletedAt: null, scope },
      select: { id: true, name: true, ossUrl: true, thumbUrl: true },
      take: 800,
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      const isChar = row.id.startsWith("character-") || row.id.startsWith("user-character-");
      if (isCharacterCatalogKind(catalogKind) !== isChar) continue;
      if (urlMatches(row.ossUrl, target) || urlMatches(row.thumbUrl, target)) {
        return { existingId: row.id, existingTitle: row.name };
      }
    }
    return null;
  }

  if (catalogKind === "style") {
    const rows = await prisma.ecomStyleLibraryEntry.findMany({
      where: { deletedAt: null, scope },
      select: { id: true, name: true, ossUrl: true, thumbUrl: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      if (urlMatches(row.ossUrl, target) || urlMatches(row.thumbUrl, target)) {
        return { existingId: row.id, existingTitle: row.name };
      }
    }
    return null;
  }

  if (catalogKind === "scene") {
    const rows = await prisma.ecomSceneLibraryEntry.findMany({
      where: { deletedAt: null, scope },
      select: { id: true, name: true, ossUrl: true, thumbUrl: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      if (urlMatches(row.ossUrl, target) || urlMatches(row.thumbUrl, target)) {
        return { existingId: row.id, existingTitle: row.name };
      }
    }
    return null;
  }

  if (catalogKind === "audio" || catalogKind === "storyboard-video") {
    return null;
  }

  return null;
}
