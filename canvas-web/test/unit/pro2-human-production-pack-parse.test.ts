import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  convertPro2HumanTabMarkdownToGfm,
  extractPro2OutlineDisplayMdFromHumanGfm,
  normalizeStoryboardSectionFromOutline,
  parseStoryboardRows,
  promotePro2HumanGfmToHubFields,
} from "@/lib/canvas/parse-md-tables";
import { extractPro2HumanProductionPackPrefix } from "@/lib/canvas/pro2-production-script-structured";
import { extractPro2ProductionScriptPatch } from "@/lib/canvas/pro2-production-script-structured";

const SAMPLE_PATH = resolve(
  process.cwd(),
  "../docs/大模型剧本返回.md ",
);

describe("pro2 human production pack parse", () => {
  const raw = readFileSync(SAMPLE_PATH, "utf-8");
  const prefix = extractPro2HumanProductionPackPrefix(raw);
  const gfm = convertPro2HumanTabMarkdownToGfm(prefix);
  const fields = promotePro2HumanGfmToHubFields(gfm);
  const storyboard = normalizeStoryboardSectionFromOutline(gfm);
  const rows = parseStoryboardRows(storyboard);

  it("extracts trailing JSON and keeps human prefix", () => {
    expect(prefix).toContain("视觉风格总纲");
    expect(prefix).toContain("分镜脚本");
    expect(prefix).not.toContain('"schemaVersion"');
    expect(extractPro2ProductionScriptPatch(raw)).not.toBeNull();
  });

  it("converts multiline tab tables to GFM sections", () => {
    expect(gfm).toContain("## 视觉风格总纲");
    expect(gfm).toContain("## 场景视觉辞典");
    expect(gfm).toContain("## 角色视觉辞典");
    expect(gfm).toContain("## 分镜脚本");
    expect(gfm).toContain("| 场景名 |");
    expect(gfm).toContain("现代办公室");
  });

  it("outline display excludes storyboard but keeps other sections", () => {
    const outline = extractPro2OutlineDisplayMdFromHumanGfm(gfm);
    expect(outline).toContain("## 视觉风格总纲");
    expect(outline).toContain("## 场景视觉辞典");
    expect(outline).toContain("## 角色视觉辞典");
    expect(outline).not.toContain("## 分镜脚本");
  });

  it("storyboard tab keeps human prop names from 道具 column", () => {
    expect(fields.storyboardMd).toContain("## 分镜脚本");
    expect(rows.length).toBeGreaterThanOrEqual(8);
    const shot1 = rows.find((r) => r.frameIndex === 1);
    expect(shot1?.propNames).toMatch(/电脑/);
    expect(shot1?.propNames).toMatch(/键盘/);
  });
});
