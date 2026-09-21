import { DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION } from "./constants";
import type {
  DetailPageVisionDecompose,
  DetailPageVisionDecomposeItem,
} from "./schemas";
import { DETAIL_PAGE_VISION_MODULE_IDS } from "./schemas";
import type {
  DetailPageVisionInventory,
  DetailPageVisionSegment,
  ReplicaSegmentMapping,
} from "./inventory-schemas";

function segmentToDecomposeItem(seg: DetailPageVisionSegment): DetailPageVisionDecomposeItem {
  return {
    item_key: seg.item_key,
    item_label: seg.item_label,
    layoutHint: seg.layoutHint,
    referenceCopyHints: seg.referenceCopyHints,
    visualDetail: seg.visualDetail,
  };
}

/** 由清单 + 映射生成 12 模块 Phase A（供润色与现有 UI） */
export function buildPhaseAFromInventoryAndMapping(
  inventory: DetailPageVisionInventory,
  mapping: ReplicaSegmentMapping,
): DetailPageVisionDecompose {
  const buckets = new Map<string, DetailPageVisionDecomposeItem[]>();
  for (const id of DETAIL_PAGE_VISION_MODULE_IDS) {
    buckets.set(id, []);
  }

  for (const seg of inventory.segments) {
    const moduleId = mapping[seg.item_key]?.module_id;
    if (!moduleId || !buckets.has(moduleId)) continue;
    buckets.get(moduleId)!.push(segmentToDecomposeItem(seg));
  }

  const modules = DETAIL_PAGE_VISION_MODULE_IDS.map((module_id) => {
    const items = buckets.get(module_id) ?? [];
    return {
      module_id,
      detected: items.length > 0,
      coverageNote:
        items.length > 0 ? undefined : "（清单中暂无归入本模块的画面）",
      items,
    };
  });

  return {
    schemaVersion: DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION,
    categoryKey: inventory.categoryKey,
    referenceSummary: inventory.referenceSummary,
    sharedVisualBrief: inventory.sharedVisualBrief,
    modules,
  };
}

export function countPendingReplicaSegments(
  inventory: DetailPageVisionInventory,
  mapping: ReplicaSegmentMapping,
): number {
  return inventory.segments.filter((s) => !mapping[s.item_key]?.module_id).length;
}

export function applyManualReplicaSegmentMapping(
  mapping: ReplicaSegmentMapping,
  itemKey: string,
  moduleId: string | null,
): ReplicaSegmentMapping {
  return {
    ...mapping,
    [itemKey]: { module_id: moduleId, source: "manual" },
  };
}
