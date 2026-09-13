import { describe, expect, it } from "vitest";

import { reconcileModuleFromAssets } from "@/lib/ecom/detail-page-suite/asset-reconcile";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

// reconcileModuleFromAssets is not exported - test via duplicate logic or export for test
// Export reconcileModuleFromAssets for unit test - actually it's not exported. Test merge behavior inline.

describe("detail-page-suite asset reconcile helpers", () => {
  it("module with missing imageUrl can be filled from asset map", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod1_banner",
      module_name: "首屏",
      enable: true,
      generate_count: 1,
      max_num: 1,
      select_mode: "manual",
      candidate_pool: ["首屏"],
      selected_item_list: ["首屏"],
      slots: [
        {
          item_key: "item_1",
          item_label: "首屏",
          source: "template",
          positive_prompt: "已有提示词内容",
        },
      ],
    };
    const assets = new Map([
      [
        "mod1_banner::item_1",
        [
          {
            id: "asset1",
            ossUrl: "https://cdn.example.com/a.png",
            prompt: "已有提示词内容",
            createdAt: new Date("2026-09-13T10:00:00.000Z"),
          },
        ],
      ],
    ]);
    const { mod: next, recoveredImages } = reconcileModuleFromAssets(mod, assets);
    expect(recoveredImages).toBe(1);
    expect(next.slots[0]?.imageUrl).toBe("https://cdn.example.com/a.png");
  });
});
