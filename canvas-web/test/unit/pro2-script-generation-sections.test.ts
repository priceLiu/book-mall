import { describe, expect, it } from "vitest";
import {
  PRO2_HUB_SECTION_ORDER,
  resolvePro2HubScriptGenerationSections,
} from "@/lib/canvas/pro2-script-generation-sections";

describe("resolvePro2HubScriptGenerationSections", () => {
  it("runs full pipeline when no outline source", () => {
    expect(resolvePro2HubScriptGenerationSections("")).toEqual(
      PRO2_HUB_SECTION_ORDER,
    );
    expect(resolvePro2HubScriptGenerationSections("   ")).toEqual(
      PRO2_HUB_SECTION_ORDER,
    );
  });

  it("skips outline LLM when outline already exists (linked or uploaded)", () => {
    expect(resolvePro2HubScriptGenerationSections("## 第一集\n…")).toEqual([
      "character",
      "scene",
      "storyboard",
    ]);
  });
});
