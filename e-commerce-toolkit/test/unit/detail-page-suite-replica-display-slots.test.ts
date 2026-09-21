import { describe, expect, it } from "vitest";

import { resolveReplicaModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import type { DetailPageSuiteModuleState } from "@/lib/detail-page-suite-types";

describe("resolveReplicaModuleDisplaySlots", () => {
  it("shows placeholder grids when module was legacy disabled", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod1_banner",
      module_name: "首屏主视觉海报",
      enable: false,
      generate_count: 0,
      max_num: 1,
      select_mode: "manual",
      candidate_pool: ["首屏模特全身氛围感穿搭，产品主体突出，宽幅详情长图"],
      selected_item_list: [],
      slots: [],
    };
    const slots = resolveReplicaModuleDisplaySlots(mod);
    expect(slots.length).toBe(1);
    expect(slots[0]?.item_label).toContain("首屏");
  });
});
