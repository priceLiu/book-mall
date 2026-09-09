import type { VtonGarmentItem, VtonLookSpec } from "@/lib/vton-types";

/** 搭配编排中已占用的服装 id */
export function collectLookDraftGarmentIds(looks: VtonLookSpec[]): Set<string> {
  const ids = new Set<string>();
  for (const look of looks) {
    if (look.topGarmentId) ids.add(look.topGarmentId);
    if (look.bottomGarmentId) ids.add(look.bottomGarmentId);
    if (look.onePieceGarmentId) ids.add(look.onePieceGarmentId);
    if (look.fullSetGarmentId) ids.add(look.fullSetGarmentId);
  }
  return ids;
}

function shouldShowGarmentInPool(g: VtonGarmentItem, used: Set<string>): boolean {
  // 套装始终留在服装池，展示原图与分割双槽（编排区另有一份预览）
  if (g.kind === "full_set") return true;
  return !used.has(g.id);
}

/** 服装池中尚未编入搭配的条目（供上传区展示） */
export function filterAvailableGarmentPool(
  pool: VtonGarmentItem[],
  looks: VtonLookSpec[],
): VtonGarmentItem[] {
  const used = collectLookDraftGarmentIds(looks);
  return pool.filter((g) => shouldShowGarmentInPool(g, used));
}

