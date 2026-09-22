import { describe, expect, it } from "vitest";

import { parseSuite } from "@/lib/ecom/detail-page-suite/parse";

describe("parseSuite hit slot fields", () => {
  it("preserves slot_copy, slot_copy_ai, burn_copy_in_image", () => {
    const suite = parseSuite({
      modules: [
        {
          module_id: "hit_full_banner_1",
          module_name: "首屏",
          enable: true,
          generate_count: 1,
          max_num: 1,
          select_mode: "manual",
          candidate_pool: ["首屏钩子1"],
          selected_item_list: ["首屏钩子1"],
          slots: [
            {
              item_key: "banner_1",
              item_label: "首屏钩子1",
              positive_prompt: "场景描述…",
              slot_copy: "暖到心里",
              slot_copy_ai: "暖到心里",
              burn_copy_in_image: true,
            },
          ],
        },
      ],
    });
    const slot = suite.modules[0]?.slots[0];
    expect(slot?.positive_prompt).toContain("场景");
    expect(slot?.slot_copy).toBe("暖到心里");
    expect(slot?.slot_copy_ai).toBe("暖到心里");
    expect(slot?.burn_copy_in_image).toBe(true);
  });
});
