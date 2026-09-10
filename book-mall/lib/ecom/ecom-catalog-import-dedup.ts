import { normalizePoseSourceImageUrl } from "@/lib/ecom/ecom-pose-library-import-helpers";
import { findPoseEntryByNormalizedSourceUrl } from "@/lib/ecom/ecom-pose-library-service";
import { prisma } from "@/lib/prisma";

export type CatalogDuplicateHit = {
  existingId: string;
  existingTitle: string;
};

function norm(url: string): string {
  return normalizePoseSourceImageUrl(url);
}

/** 同一图片 URL（含已入库 thumb）再次保存 → 409 */
export async function findCatalogDuplicateByImageUrl(
  imageUrl: string,
): Promise<CatalogDuplicateHit | null> {
  const target = norm(imageUrl);
  if (!target) return null;

  const pose = await findPoseEntryByNormalizedSourceUrl(imageUrl);
  if (pose) {
    return { existingId: pose.id, existingTitle: pose.title };
  }

  function urlMatches(stored: string | null | undefined): boolean {
    if (!stored?.trim()) return false;
    return norm(stored) === target;
  }

  const garment = await prisma.ecomGarmentLibraryEntry.findFirst({
    where: { deletedAt: null, OR: [{ ossUrl: imageUrl.trim() }, { thumbUrl: imageUrl.trim() }] },
    select: { id: true, name: true, ossUrl: true, thumbUrl: true },
  });
  if (garment && (urlMatches(garment.ossUrl) || urlMatches(garment.thumbUrl))) {
    return { existingId: garment.id, existingTitle: garment.name };
  }

  const fullBody = await prisma.ecomFullBodyModelEntry.findFirst({
    where: { deletedAt: null, OR: [{ ossUrl: imageUrl.trim() }, { thumbUrl: imageUrl.trim() }] },
    select: { id: true, name: true, ossUrl: true, thumbUrl: true },
  });
  if (fullBody && (urlMatches(fullBody.ossUrl) || urlMatches(fullBody.thumbUrl))) {
    return { existingId: fullBody.id, existingTitle: fullBody.name };
  }

  const avatar = await prisma.ecomModelLibraryEntry.findFirst({
    where: { deletedAt: null, OR: [{ ossUrl: imageUrl.trim() }, { thumbUrl: imageUrl.trim() }] },
    select: { id: true, name: true, ossUrl: true, thumbUrl: true },
  });
  if (avatar && (urlMatches(avatar.ossUrl) || urlMatches(avatar.thumbUrl))) {
    return { existingId: avatar.id, existingTitle: avatar.name };
  }

  return null;
}
