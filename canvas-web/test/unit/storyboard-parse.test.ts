import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { parseStoryboardRows } from "@/lib/canvas/parse-md-tables";

describe("parseStoryboardRows", () => {
  it("parses ## 分镜脚本 section table, not a leading summary table", () => {
    const md = `## 分镜概要

| 项目 | 内容 |
|------|------|
| 规划镜数 | 12 |

## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 全景 | 固定 | 【起始】A。【结束】B。 | — | 8 | img en | vid zh | lip |
| 2 | 中景 | 推 | 【起始】B。【结束】C。 | 甲：「 hi 」 | 6 | img2 | vid2 | — |`;

    const rows = parseStoryboardRows(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.frameIndex).toBe(1);
    expect(rows[0]?.duration).toBe("8");
    expect(rows[1]?.duration).toBe("6");
  });

  it("reads full-width 时长（秒） column header", () => {
    const md = `| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长（秒） | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|------------|---------------------|---------------------|---------------|
| 1 | 全景 | 固定 | desc | — | 5 | img | vid | — |`;
    const rows = parseStoryboardRows(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.duration).toBe("5");
  });
});
