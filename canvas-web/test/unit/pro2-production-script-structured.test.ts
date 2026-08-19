import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  describePro2ProductionScriptParseFailure,
  extractPro2ProductionScriptPatch,
  isPro2ProductionScriptFenceComplete,
  isUnparsedPro2ProductionJsonBlob,
  pro2PatchStepMatchesSection,
  stripPro2ProductionScriptFence,
} from "@/lib/canvas/pro2-production-script-structured";
import {
  PRO2_FIXTURE_FULL_PACK,
  fixtureWithFence,
} from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-structured", () => {
  it("extracts patch from fence", () => {
    const text = fixtureWithFence(PRO2_FIXTURE_FULL_PACK);
    const patch = extractPro2ProductionScriptPatch(text);
    expect(patch?.step).toBe("full_pack");
    expect(patch?.patch.shots?.length).toBe(2);
    expect(patch?.patch.characters?.length).toBe(1);
  });

  it("stripPro2ProductionScriptFence removes fence block", () => {
    const text = fixtureWithFence(PRO2_FIXTURE_FULL_PACK);
    const stripped = stripPro2ProductionScriptFence(text);
    expect(stripped).not.toContain("pro2-production-script");
    expect(stripped).toContain("视觉风格总纲");
  });

  it("isPro2ProductionScriptFenceComplete detects closed fence", () => {
    const text = fixtureWithFence(PRO2_FIXTURE_FULL_PACK);
    expect(isPro2ProductionScriptFenceComplete(text)).toBe(true);
    expect(
      isPro2ProductionScriptFenceComplete("```pro2-production-script\n{"),
    ).toBe(false);
  });

  it("rejects invalid JSON with trailing comma", () => {
    const text = [
      "```pro2-production-script",
      '{"schemaVersion":1,"tier":"pro","step":"outline","patch":{},}',
      "```",
    ].join("\n");
    expect(extractPro2ProductionScriptPatch(text)).toBeNull();
  });

  it("normalizes tier pro2 and flat patch fields only", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      tier: "pro2",
      step: "outline",
      patch: 0,
      visualStyle: { worldBackground: "穿越", era: "唐" },
      coreConflict: [{ dimension: "冲突", content: "内容" }],
      handoff: [{ index: 1, item: "三视图", owner: "美术", note: "—" }],
    });
    const patch = extractPro2ProductionScriptPatch(raw);
    expect(patch?.tier).toBe("pro");
    expect(patch?.patch.visualStyle?.worldBackground).toBe("穿越");
  });

  it("rejects LLM alias fields (identity / aiImagePrompt / string handoff)", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      tier: "pro",
      step: "full_pack",
      patch: {
        title: "我在盛唐写天下",
        visualStyle: {
          worldBackground: "穿越盛唐",
          era: "盛唐",
          photographyStyle: "史诗广角",
          dayPalette: "主暖金 #D4A050",
        },
        characters: [
          {
            name: "沈昭昭",
            identity: "女主",
            aiImagePrompt: "tang official",
          },
        ],
        handoff: ["角色三视图：按角色表生成"],
        shots: [
          {
            index: 1,
            description: "殿内",
            aiImagePrompt: "close up",
          },
        ],
      },
    });
    expect(extractPro2ProductionScriptPatch(raw)).toBeNull();
    const err = describePro2ProductionScriptParseFailure(raw);
    expect(err).toBeTruthy();
  });

  it("pro2PatchStepMatchesSection allows full_pack on outline section", () => {
    expect(pro2PatchStepMatchesSection("full_pack", "outline")).toBe(true);
    expect(pro2PatchStepMatchesSection("character", "outline")).toBe(false);
  });

  it("parses schema-compliant tang-dynasty pack", () => {
    const raw = readFileSync(
      join(__dirname, "../fixtures/pro2-tang-dynasty-pack.json"),
      "utf8",
    );
    const patch = extractPro2ProductionScriptPatch(raw);
    expect(patch?.patch.meta?.title).toBe("我在盛唐写天下");
    expect(patch?.patch.characters?.length).toBe(2);
    expect(patch?.patch.shots?.length).toBe(2);
    expect(patch?.patch.handoff?.length).toBe(6);
  });

  it("extracts patch from ## 分镜脚本 header + pretty-printed JSON", () => {
    const raw = readFileSync(
      join(__dirname, "../fixtures/pro2-tang-dynasty-pack.json"),
      "utf8",
    );
    const text = `## 分镜脚本\n\n${JSON.stringify(JSON.parse(raw), null, 2)}`;
    const patch = extractPro2ProductionScriptPatch(text);
    expect(patch?.step).toBe("full_pack");
    expect(patch?.patch.meta?.title).toBe("我在盛唐写天下");
    expect(patch?.patch.shots?.length).toBe(2);
  });

  it("does not flag rendered markdown outline as JSON blob", () => {
    const rendered = [
      "## 视觉风格总纲",
      "",
      "| 维度 | 内容 |",
      "|------|------|",
      "| 故事背景 | 现代 × 盛唐 |",
      "",
      "```pro2-production-script",
      '{"schemaVersion":2,"tier":"pro","step":"full_pack","patch":{"visualStyle":{"worldBackground":"x"}}}',
      "```",
    ].join("\n");
    expect(isUnparsedPro2ProductionJsonBlob(rendered)).toBe(false);
  });

  it("parses full_pack from human markdown + trailing JSON (大模型剧本返回)", () => {
    const text = readFileSync(
      join(__dirname, "../../../docs/大模型剧本返回.md "),
      "utf8",
    );
    expect(isUnparsedPro2ProductionJsonBlob(text)).toBe(false);
    const patch = extractPro2ProductionScriptPatch(text);
    expect(patch?.step).toBe("full_pack");
    expect(patch?.patch.meta?.title).toBe("我在盛唐写天下");
    expect(patch?.patch.characters?.length).toBe(4);
    expect(patch?.patch.scenes?.length).toBe(4);
    expect(patch?.patch.shots?.length).toBe(16);
    expect(patch?.patch.handoff?.length).toBe(10);
  });
});
