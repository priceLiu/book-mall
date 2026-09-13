import { describe, expect, it } from "vitest";

import {
  resolveModuleDisplaySlots,
  syncModuleSlotsFromSelection,
} from "@/lib/detail-page-suite-module-slots";
import type { DetailPageSuiteModuleState } from "@/lib/detail-page-suite-types";

const baseMod = (): DetailPageSuiteModuleState => ({
  module_id: "mod1",
  module_name: "首屏",
  enable: true,
  generate_count: 2,
  max_num: 6,
  select_mode: "manual",
  candidate_pool: ["正面全身", "侧面", "背面"],
  selected_item_list: ["正面全身", "侧面"],
  slots: [],
});

describe("detail-page-suite-module-slots", () => {
  it("builds placeholder slots from selected_item_list", () => {
    const slots = resolveModuleDisplaySlots(baseMod());
    expect(slots).toHaveLength(2);
    expect(slots[0]?.item_label).toBe("正面全身");
    expect(slots[0]?.positive_prompt).toBe("");
  });

  it("preserves existing slot data by label", () => {
    const mod = {
      ...baseMod(),
      slots: [
        {
          item_key: "item_a",
          item_label: "正面全身",
          source: "template" as const,
          positive_prompt: "已有 prompt",
        },
      ],
    };
    const slots = resolveModuleDisplaySlots(mod);
    expect(slots[0]?.positive_prompt).toBe("已有 prompt");
  });

  it("syncModuleSlotsFromSelection writes slots array", () => {
    const synced = syncModuleSlotsFromSelection(baseMod());
    expect(synced.slots).toHaveLength(2);
  });
});
