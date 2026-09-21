import { describe, expect, it } from "vitest";

import { ensureDetailPageSuiteSizeChartModuleAtEnd } from "@/lib/ecom/detail-page-suite/ensure-size-chart-module-at-end";
import { DETAIL_PAGE_SUITE_SIZE_MODULE_ID } from "@/lib/ecom/detail-page-suite/size-chart-constants";

describe("ensureDetailPageSuiteSizeChartModuleAtEnd", () => {
  it("appends size module when missing", () => {
    const { suite, changed } = ensureDetailPageSuiteSizeChartModuleAtEnd({
      modules: [
        {
          module_id: "comp_a",
          module_name: "卖点",
          enable: true,
          generate_count: 1,
          max_num: 3,
          select_mode: "manual",
          candidate_pool: ["a"],
          selected_item_list: ["a"],
          slots: [],
        },
      ],
      templateSnapshot: null,
    });
    expect(changed).toBe(true);
    expect(suite.modules.at(-1)?.module_id).toBe(DETAIL_PAGE_SUITE_SIZE_MODULE_ID);
    expect(suite.modules.at(-1)?.enable).toBe(true);
  });

  it("moves existing size module to the end", () => {
    const size = {
      module_id: DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
      module_name: "尺码参考模块",
      enable: false,
      generate_count: 0,
      max_num: 6,
      select_mode: "manual" as const,
      candidate_pool: ["尺码数据总表图"],
      selected_item_list: [],
      slots: [],
    };
    const { suite } = ensureDetailPageSuiteSizeChartModuleAtEnd({
      modules: [size, { ...size, module_id: "mod8_scene", module_name: "场景" }],
      templateSnapshot: null,
    });
    expect(suite.modules.at(-1)?.module_id).toBe(DETAIL_PAGE_SUITE_SIZE_MODULE_ID);
    expect(suite.modules.at(-1)?.enable).toBe(true);
  });
});
