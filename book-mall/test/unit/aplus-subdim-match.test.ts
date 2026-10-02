import { describe, expect, it } from "vitest";

import {
  autoMatchAplusSelectedItems,
  applyAutoMatchToSuite,
  normalizeAplusProductVertical,
} from "@/lib/ecom/detail-page-aplus/aplus-subdim-match";
import { DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL } from "@/lib/ecom/detail-page-suite/size-chart-constants";
import { DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL } from "@/lib/ecom/detail-page-suite/spec-table-constants";

describe("autoMatchAplusSelectedItems", () => {
  it("returns empty when generate_count is 0", () => {
    expect(
      autoMatchAplusSelectedItems(
        {
          module_id: "aplus_usage_scene",
          candidate_pool: ["通勤", "户外"],
          generate_count: 0,
        },
        { vertical: "fashion_apparel" },
      ),
    ).toEqual([]);
  });

  it("prefers bag scene labels for bags vertical", () => {
    const selected = autoMatchAplusSelectedItems(
      {
        module_id: "aplus_usage_scene",
        candidate_pool: ["居家", "通勤", "户外", "礼品"],
        generate_count: 2,
      },
      { vertical: "bags" },
    );
    expect(selected).toHaveLength(2);
    expect(selected[0]).toBe("通勤");
  });

  it("applyAutoMatchToSuite fills selected_item_list from pool", () => {
    const suite = applyAutoMatchToSuite(
      {
        modules: [
          {
            module_id: "aplus_size_capacity",
            module_name: "尺码",
            enable: true,
            generate_count: 1,
            max_num: 3,
            select_mode: "manual",
            candidate_pool: [DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL, "线稿示意"],
            selected_item_list: [],
            slots: [],
          },
        ],
      },
      { productVertical: "baby_maternal" },
    );
    expect(suite.modules[0]!.selected_item_list).toEqual([
      DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
    ]);
  });

  it("spec module picks data label first", () => {
    const selected = autoMatchAplusSelectedItems(
      {
        module_id: "aplus_spec_table",
        candidate_pool: [DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL, "包装清单"],
        generate_count: 1,
      },
      { vertical: normalizeAplusProductVertical("digital_3c") },
    );
    expect(selected[0]).toBe(DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL);
  });

  it("normalizes legacy apparel to fashion_apparel", () => {
    expect(normalizeAplusProductVertical("apparel")).toBe("fashion_apparel");
  });

  it("footwear prioritizes sport-related usage labels when present", () => {
    const selected = autoMatchAplusSelectedItems(
      {
        module_id: "aplus_usage_scene",
        candidate_pool: ["居家", "运动", "通勤"],
        generate_count: 1,
      },
      { vertical: "footwear" },
    );
    expect(selected[0]).toBe("运动");
  });
});
