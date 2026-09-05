import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  parseStoryboardRows,
  extractStoryboardSectionFromOutline,
  normalizeStoryboardSectionFromOutline,
} from "@/lib/canvas/parse-md-tables";
import {
  promoteEmbeddedPackFromOutline,
  resolveHubStoryboardMd,
} from "@/lib/canvas/story-hub-runtime";

describe("parseStoryboardRows", () => {
  it("parses ## 分镜脚本 section table, not a leading summary table", () => {
    const md = `## 分镜概要

| 项目 | 内容 |
|------|------|
| 规划镜数 | 12 |

## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 全景 | 暖调侧光 | 固定 | 【起始】A。【结束】B。 | — | — | 8 | 环境音 | lip |
| 2 | 中景 | 侧逆光 | 推 | 【起始】B。【结束】C。 | 道具A | 甲：「 hi 」 | 6 | 敲击声 | — |`;

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

  it("parses multiple rows when cells contain <br> (LLM full-pack)", () => {
    const md = `${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 远景 | 暖金逆光 | 横摇 | 起始：A。<br>动作：B。<br>终止：C。 | — | — | 10 | 风声 | — |
| 2 | 中景 | 柔光 | 固定 | 起始：D。<br>终止：E。 | 竹简 | 台词 | 8 | 脚步 | BGM |`;
    expect(parseStoryboardRows(md)).toHaveLength(2);
  });

  it("full-pack task textOutput yields many storyboard rows (regression)", () => {
    if (!existsSync("/tmp/full-pack.txt")) return;
    const text = readFileSync("/tmp/full-pack.txt", "utf8");
    const promoted = promoteEmbeddedPackFromOutline(text, "", "", "");
    const rows = parseStoryboardRows(promoted.storyboardMd);
    expect(rows.length).toBeGreaterThan(10);
    expect(parseStoryboardRows(extractStoryboardSectionFromOutline(text)).length).toBeGreaterThan(10);
    expect(parseStoryboardRows(normalizeStoryboardSectionFromOutline(text)).length).toBeGreaterThan(10);
  });

  it("resolveHubStoryboardMd keeps all rows when re-promoting stale hub", () => {
    if (!existsSync("/tmp/full-pack.txt") || !existsSync("/tmp/hub-data.json"))
      return;
    const text = readFileSync("/tmp/full-pack.txt", "utf8");
    const d = JSON.parse(readFileSync("/tmp/hub-data.json", "utf8"));
    const resolved = resolveHubStoryboardMd(d);
    expect(parseStoryboardRows(resolved).length).toBeGreaterThan(10);
  });
});
