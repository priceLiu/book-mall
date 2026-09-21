import { describe, expect, it } from "vitest";

import {
  applyManualReplicaSegmentMapping,
  buildPhaseAFromInventoryAndMapping,
  countPendingReplicaSegments,
  replicaSegmentMappingFromClassifyBatch,
} from "@/lib/ecom/detail-page-vision-decompose";
import type { DetailPageVisionInventory } from "@/lib/ecom/detail-page-vision-decompose/inventory-schemas";

const inventory: DetailPageVisionInventory = {
  segments: [
    { segmentIndex: 1, item_key: "seg_1", item_label: "首屏" },
    { segmentIndex: 2, item_key: "seg_2", item_label: "三防卖点" },
    { segmentIndex: 3, item_key: "seg_3", item_label: "待归类" },
  ],
};

describe("buildPhaseAFromInventoryAndMapping", () => {
  it("groups mapped segments into modules", () => {
    const mapping = {
      seg_1: { module_id: "mod1_banner", source: "auto" as const, confidence: "high" as const },
      seg_2: { module_id: "mod2_highlight", source: "auto" as const, confidence: "high" as const },
      seg_3: { module_id: null, source: "auto" as const, confidence: "low" as const },
    };
    const phaseA = buildPhaseAFromInventoryAndMapping(inventory, mapping);
    expect(phaseA.modules[0].module_id).toBe("mod1_banner");
    expect(phaseA.modules[0].items).toHaveLength(1);
    expect(phaseA.modules[0].items[0].item_key).toBe("seg_1");
    expect(phaseA.modules[1].items).toHaveLength(1);
    expect(countPendingReplicaSegments(inventory, mapping)).toBe(1);
  });

  it("low confidence classify stays unmapped until manual assign", () => {
    const auto = replicaSegmentMappingFromClassifyBatch({
      mappings: [
        { item_key: "seg_3", module_id: "mod3_model_show", confidence: "low" },
      ],
    });
    expect(auto.seg_3.module_id).toBeNull();
    const base = {
      seg_1: { module_id: "mod1_banner", source: "auto" as const },
      seg_2: { module_id: "mod2_highlight", source: "auto" as const },
      ...auto,
    };
    expect(countPendingReplicaSegments(inventory, base)).toBe(1);
    const manual = applyManualReplicaSegmentMapping(base, "seg_3", "mod3_model_show");
    expect(manual.seg_3.source).toBe("manual");
    expect(countPendingReplicaSegments(inventory, manual)).toBe(0);
  });
});
