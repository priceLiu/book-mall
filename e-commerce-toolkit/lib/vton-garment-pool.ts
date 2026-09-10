import {
  isFullSetGarmentReady,
  resolveFullSetInputMode,
} from "@/lib/vton-full-set-garment";
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
  if (g.kind === "full_set") {
    const mode = resolveFullSetInputMode(g);
    // 双槽套装已编入搭配且上下装齐全 → 清空上传区，留空槽给下一套
    if (mode === "manual" && used.has(g.id) && isFullSetGarmentReady(g)) {
      return false;
    }
    // 整图分割套装仍留在池，展示原图与分割结果（编排区另有预览）
    return true;
  }
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

