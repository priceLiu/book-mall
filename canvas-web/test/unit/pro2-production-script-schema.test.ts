import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coercePro2ColorBlockInput,
  coercePro2DialogueForParse,
  listPro2CreativeDurationIssues,
  listPro2IndustrialAnalysisIssues,
  listPro2SemanticPatchIssues,
  listPro2ShotDialogueIssues,
  normalizePro2CreativeShotDurations,
  pro2ProductionScriptPatchSchema,
  pro2ProductionScriptSchema,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-schema", () => {
  it("coerces colorBlock string and drops placeholders", () => {
    expect(coercePro2ColorBlockInput("冷蓝低饱和")).toEqual({
      primary: "冷蓝低饱和",
    });
    expect(coercePro2ColorBlockInput("—")).toBeUndefined();
    expect(coercePro2ColorBlockInput({ primary: "#1A2030" })).toEqual({
      primary: "#1A2030",
    });
  });

  it("accepts valid full_pack pro fixture", () => {
    const result = pro2ProductionScriptPatchSchema.safeParse(PRO2_FIXTURE_FULL_PACK);
    expect(result.success).toBe(true);
  });

  it("rejects pro tier shot missing required fields", () => {
    const bad = {
      ...PRO2_FIXTURE_FULL_PACK,
      patch: {
        shots: [
          {
            index: 1,
            sceneDescription: "只有描述",
            dialogue: "—",
          },
        ],
      },
      step: "storyboard" as const,
    };
    const result = pro2ProductionScriptPatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects full_pack missing handoff block", () => {
    const bad = {
      ...PRO2_FIXTURE_FULL_PACK,
      patch: { visualStyle: PRO2_FIXTURE_FULL_PACK.patch.visualStyle },
    };
    const result = pro2ProductionScriptPatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("industrial storyboard fails without analysis", () => {
    const issues = listPro2SemanticPatchIssues(
      {
        meta: { packProfile: "industrial", source: "creative" },
        shots: [
          {
            index: 1,
            shotSize: "特写",
            lighting: "冷光压抑氛围测试用例",
            cameraMove: "固定机位缓慢推近主体面部",
            sceneDescription: "【起始】伏案。【结束】抬头",
            dialogue: "—",
            durationSec: 12,
          },
        ],
      },
      "storyboard",
    );
    expect(issues.some((i) => i.includes("缺少 analysis"))).toBe(true);
  });

  it("accepts dialogue without emotion parentheses", () => {
    const raw = '萧景珩："姑娘，下次翻墙，记得看路。"';
    expect(listPro2ShotDialogueIssues([{ index: 10, dialogue: raw }])).toHaveLength(
      0,
    );
    expect(coercePro2DialogueForParse(raw)).toBe(raw);
  });

  it("normalizes curly quotes and strips 说 before colon", () => {
    const curly = "萧景珩（温和）：“姑娘小心。”";
    expect(coercePro2DialogueForParse(curly)).toBe('萧景珩（温和）："姑娘小心。"');
    expect(
      listPro2ShotDialogueIssues([{ index: 1, dialogue: curly }]),
    ).toHaveLength(0);

    const withShuo = '沈昭昭说："又要加班……"';
    expect(coercePro2DialogueForParse(withShuo)).toBe('沈昭昭："又要加班……"');
    expect(
      listPro2ShotDialogueIssues([{ index: 2, dialogue: withShuo }]),
    ).toHaveLength(0);
  });

  it("director creative enforces 12–18 shots and 175–185s", () => {
    const issues = listPro2CreativeDurationIssues(
      [
        {
          index: 1,
          dialogue: "—",
          durationSec: 12,
        },
      ],
      "creative",
      "director",
    );
    expect(issues.some((i) => i.includes("12–18 镜"))).toBe(true);
    expect(issues.some((i) => i.includes("175–185"))).toBe(true);
  });

  it("normalizePro2CreativeShotDurations fixes near-miss totals when shot count ok", () => {
    const shots = Array.from({ length: 15 }, (_, i) => ({
      index: i + 1,
      durationSec: 10,
    }));
    const next = normalizePro2CreativeShotDurations(shots, "creative");
    const total = next.reduce((s, x) => s + (x.durationSec ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(175);
    expect(total).toBeLessThanOrEqual(185);
    expect(next.every((s) => (s.durationSec ?? 0) >= 10 && (s.durationSec ?? 0) <= 15)).toBe(
      true,
    );
  });

  it("normalizePro2CreativeShotDurations does not invent shots when count wrong", () => {
    const shots = Array.from({ length: 2 }, (_, i) => ({
      index: i + 1,
      durationSec: 12,
    }));
    const next = normalizePro2CreativeShotDurations(shots, "creative");
    expect(next).toHaveLength(2);
  });

  it("director profile does not require analysis", () => {
    const issues = listPro2IndustrialAnalysisIssues(
      [{ index: 1, dialogue: "—" }],
      "creative",
    );
    expect(issues.some((i) => i.includes("缺少 analysis"))).toBe(true);
    const semantic = listPro2SemanticPatchIssues(
      {
        meta: { packProfile: "director", source: "creative" },
        shots: Array.from({ length: 12 }, (_, i) => ({
          index: i + 1,
          shotSize: "特写",
          lighting: "冷光压抑氛围测试用例",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: `【起始】镜${i + 1}。【结束】抬头`,
          dialogue: "—",
          durationSec: 15,
        })),
      },
      "storyboard",
    );
    expect(semantic.some((i) => i.includes("缺少 analysis"))).toBe(false);
    expect(semantic.some((i) => i.includes("12–18"))).toBe(false);
  });

  it("film_pull industrial rejects empty analysis core fields", () => {
    const issues = listPro2IndustrialAnalysisIssues(
      [
        {
          index: 1,
          dialogue: "—",
          analysis: { cut: { detail: "无" } },
        },
        {
          index: 2,
          dialogue: "—",
          analysis: {
            cinematography: { cameraAngle: "平视", focalLength: "35mm" },
            blocking: { subjectBlocking: "角色居中", foreMidBackLayer: "前中后" },
            cut: { detail: "硬切至特写" },
          },
        },
      ],
      "film_pull",
    );
    expect(issues.some((i) => i.includes("cameraAngle"))).toBe(true);
    expect(issues.some((i) => i.includes("禁止「无」"))).toBe(true);
  });

  it("tang-dynasty full_pack fixture still parses after v3", () => {
    const raw = JSON.parse(
      readFileSync(
        join(__dirname, "../fixtures/pro2-tang-dynasty-pack.json"),
        "utf8",
      ),
    ) as unknown;
    const result = pro2ProductionScriptPatchSchema.safeParse(raw);
    expect(
      result.success,
      result.success ? "" : result.error.issues.map((i) => i.message).join(" | "),
    ).toBe(true);
  });

  it("pro2ProductionScriptSchema accepts schemaVersion 1, 2 and 3", () => {
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 1 }).success).toBe(
      true,
    );
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 2 }).success).toBe(
      true,
    );
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 3 }).success).toBe(
      true,
    );
  });
});
