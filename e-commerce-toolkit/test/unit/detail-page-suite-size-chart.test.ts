import { describe, expect, it } from "vitest";

import {
  appendDefaultSizeChartTableToBrief,
  DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
  ensureSizeChartBriefTableCount,
  isProgrammaticSizeChartRenderSlot,
  partitionDetailPageSuiteImageGenKeys,
  resolveSizeChartTableIndexForLabel,
} from "@/lib/detail-page-suite-size-chart";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

describe("detail-page-suite-size-chart", () => {
  it("maps slot labels to table indices", () => {
    expect(resolveSizeChartTableIndexForLabel("尺码数据总表图")).toBe(0);
    expect(resolveSizeChartTableIndexForLabel("尺码数据总表图 (2)")).toBe(1);
    expect(resolveSizeChartTableIndexForLabel("尺码数据总表图 (3)")).toBe(2);
  });

  it("ensureSizeChartBriefTableCount backfills tables for existing slots", () => {
    const brief = ensureSizeChartBriefTableCount(null, 2);
    expect(brief.sizeChart?.tables).toHaveLength(2);
  });

  it("partitions programmatic size chart keys from model keys", () => {
    const project = {
      suite: {
        modules: [
          {
            module_id: "mod7_size_table",
            enable: true,
            generate_count: 2,
            selected_item_list: ["尺码数据总表图", "线稿"],
            candidate_pool: ["尺码数据总表图", "线稿"],
            slots: [
              {
                item_key: "a",
                item_label: "尺码数据总表图",
                positive_prompt: DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
              },
              {
                item_key: "b",
                item_label: "线稿",
                positive_prompt: "外套线稿",
              },
            ],
          },
        ],
      },
    } as unknown as DetailPageSuiteProject;
    const { programmaticKeys, modelKeys } = partitionDetailPageSuiteImageGenKeys(project, [
      "mod7_size_table::a",
      "mod7_size_table::b",
    ]);
    expect(programmaticKeys).toEqual(["mod7_size_table::a"]);
    expect(modelKeys).toEqual(["mod7_size_table::b"]);
    expect(
      isProgrammaticSizeChartRenderSlot({
        item_label: "尺码数据总表图",
        positive_prompt: DETAIL_PAGE_SUITE_SIZE_CHART_PROMPT_MARKER,
      }),
    ).toBe(true);
  });

  it("appendDefaultSizeChartTableToBrief adds labeled slot", () => {
    const first = appendDefaultSizeChartTableToBrief(null);
    expect(first.label).toBe("尺码数据总表图");
    expect(first.brief.sizeChart?.tables).toHaveLength(1);

    const second = appendDefaultSizeChartTableToBrief(first.brief);
    expect(second.label).toBe("尺码数据总表图 (2)");
    expect(second.brief.sizeChart?.tables).toHaveLength(2);
  });
});
