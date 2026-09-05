import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_HANDOFF_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  extractHandoffSectionFromOutline,
  parseHandoffRows,
} from "@/lib/canvas/parse-md-tables";

describe("parseHandoffRows", () => {
  it("parses canonical 4-column handoff table", () => {
    const md = `## 下一步交接清单

${STORY_PRO2_HANDOFF_TABLE_HEADER}
| 1 | 角色三视图生成 | 后期/美术 | 纯白背景 2K |
| 2 | 场景图生成 | 后期/美术 | 按场景辞典 |
| 3 | 分镜视频生成 | AI视频 | Seedance 占位符 |`;

    const rows = parseHandoffRows(md);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      index: "1",
      item: "角色三视图生成",
      owner: "后期/美术",
      note: "纯白背景 2K",
    });
  });

  it("compat legacy 3-column handoff header", () => {
    const md = `| 环节 | 说明 | 建议工具/步骤 |
|------|------|----------------|
| 角色三视图 | 生成主要角色 | 生图引擎 |
| 场景空镜 | 逐场景生成 | 场景图组 |`;

    const rows = parseHandoffRows(md);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]?.item).toContain("角色");
  });

  it("extractHandoffSectionFromOutline finds section in outline md", () => {
    const outline = [
      "## 核心冲突",
      "",
      "## 下一步交接清单",
      "",
      STORY_PRO2_HANDOFF_TABLE_HEADER,
      "| 1 | 剪辑交付 | 后期 | 粗剪+调色 |",
    ].join("\n");
    const section = extractHandoffSectionFromOutline(outline);
    expect(section).toContain("序号");
    expect(section).toContain("剪辑交付");
  });
});
