import { describe, expect, it } from "vitest";
import {
  extractPro2ProductionScriptPatch,
  isPro2ProductionScriptFenceComplete,
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

  it("pro2PatchStepMatchesSection maps hub sections", () => {
    expect(pro2PatchStepMatchesSection("full_pack", "outline")).toBe(true);
    expect(pro2PatchStepMatchesSection("outline", "outline")).toBe(true);
    expect(pro2PatchStepMatchesSection("character", "storyboard")).toBe(false);
    expect(pro2PatchStepMatchesSection("full_pack", "storyboard")).toBe(true);
  });
});
