import { describe, expect, it } from "vitest";

import {
  buildModelShotCollectionSummary,
  buildModelShotCollectionSummaryTableMarkdown,
  buildModelShotCollectionSummaryRows,
  parseModelShotCollectionSummaryMessage,
} from "@/lib/model-shot-workflow";
import type { ModelShotProject } from "@/lib/model-shot-types";

const project: ModelShotProject = {
  id: "p1",
  title: "测试",
  module: "model-shot",
  status: "draft",
  settings: {},
  references: [
    { id: "g1", role: "garment", source: "upload", ossUrl: "https://example.com/g.jpg" },
    { id: "m1", role: "model", source: "library", name: "女模特088" },
    { id: "s1", role: "scene", source: "none", name: "跳过场景" },
    { id: "p0", role: "prop", source: "none", name: "不需要道具" },
  ],
  brief: {
    styles: ["优雅", "温柔"],
    platform: "品牌 lookbook",
    poseCount: 6,
  },
  plan: { status: "draft", items: [] },
  chatHistory: [],
  meta: { propDeferred: false, wizard: { summaryAcknowledged: false } },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("model-shot collection summary", () => {
  it("builds summary rows", () => {
    const rows = buildModelShotCollectionSummaryRows(project);
    expect(rows).toEqual([
      { label: "模特", value: "女模特088" },
      { label: "场景", value: "跳过（出图时由模型自由发挥）" },
      { label: "道具", value: "不需要" },
      { label: "风格", value: "优雅、温柔" },
      { label: "平台/用途", value: "品牌 lookbook" },
      { label: "姿势张数", value: "6 张" },
    ]);
  });

  it("renders markdown table", () => {
    const md = buildModelShotCollectionSummaryTableMarkdown(buildModelShotCollectionSummaryRows(project));
    expect(md).toContain("| 项目 | 已选配置 |");
    expect(md).toContain("| 场景 | 跳过（出图时由模型自由发挥） |");
  });

  it("includes table in full summary message", () => {
    const text = buildModelShotCollectionSummary(project);
    expect(text).toContain("| 模特 | 女模特088 |");
    expect(text).not.toContain("- **模特**");
  });

  it("parses table summary message", () => {
    const text = buildModelShotCollectionSummary(project);
    const parsed = parseModelShotCollectionSummaryMessage(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.intro).toContain("信息采集已完成");
    expect(parsed!.rows).toHaveLength(6);
    expect(parsed!.rows[0]).toEqual({ label: "模特", value: "女模特088" });
    expect(parsed!.outro).toContain("接下来将为您编排");
  });

  it("parses legacy bullet summary message", () => {
    const legacy = `明白。信息采集已完成，汇总如下：

- **模特**：女模特088
- **场景**：跳过（出图时由模型自由发挥）
- **道具**：不需要

接下来将为您编排 6 张姿势。`;
    const parsed = parseModelShotCollectionSummaryMessage(legacy);
    expect(parsed!.rows).toEqual([
      { label: "模特", value: "女模特088" },
      { label: "场景", value: "跳过（出图时由模型自由发挥）" },
      { label: "道具", value: "不需要" },
    ]);
  });
});
