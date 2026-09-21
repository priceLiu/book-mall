import { describe, expect, it } from "vitest";

import {
  DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL,
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
} from "@/lib/ecom/detail-page-suite/size-chart-constants";
import {
  isLegacySizeChartModule,
  migrateDetailPageSuiteProject,
} from "@/lib/ecom/detail-page-suite/suite-migrate";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

const legacyMod = (): DetailPageSuiteModuleState => ({
  module_id: "mod7_size_table",
  module_name: "尺码表",
  enable: true,
  generate_count: 1,
  max_num: 1,
  select_mode: "manual",
  candidate_pool: ["尺码表空白底图，浅纯色干净背景，预留表格区域"],
  selected_item_list: ["尺码表空白底图，浅纯色干净背景，预留表格区域"],
  slots: [],
});

describe("detail-page-suite suite migrate", () => {
  it("detects legacy size module", () => {
    expect(isLegacySizeChartModule(legacyMod())).toBe(true);
  });

  it("migrates mod7 to new pool and programmatic prompt", () => {
    const { project, changed } = migrateDetailPageSuiteProject({
      id: "p1",
      title: "t",
      module: "detail-page-suite",
      status: "draft",
      brief: null,
      settings: {},
      references: [],
      chatHistory: [],
      suite: { modules: [legacyMod()] },
      meta: null,
      createdAt: "",
      updatedAt: "",
    });
    expect(changed).toBe(true);
    const mod = project.suite.modules[0]!;
    expect(mod.module_name).toBe("尺码参考模块");
    expect(mod.max_num).toBe(6);
    expect(mod.candidate_pool).toContain(DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL);
    expect(mod.selected_item_list[0]).toBe(DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL);
    expect(project.brief?.sizeChart?.tables?.length).toBeGreaterThan(0);
    const slot = mod.slots.find((s) => s.item_label === DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL);
    expect(slot?.positive_prompt).toBe(DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER);
  });
});
