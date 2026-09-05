import { describe, expect, it } from "vitest";
import { resolvePro2HubScriptGenerationSections } from "@/lib/canvas/pro2-script-generation-sections";

describe("resolvePro2HubScriptGenerationSections", () => {
  it("always runs single outline full_pack LLM (no 4-section pipeline)", () => {
    expect(resolvePro2HubScriptGenerationSections("")).toEqual(["outline"]);
    expect(resolvePro2HubScriptGenerationSections("   ")).toEqual(["outline"]);
    expect(resolvePro2HubScriptGenerationSections("## 第一集\n…")).toEqual([
      "outline",
    ]);
    expect(
      resolvePro2HubScriptGenerationSections(
        "## 第一集\n3分钟",
        "gu-feng-tian-chong",
      ),
    ).toEqual(["outline"]);
  });
});
