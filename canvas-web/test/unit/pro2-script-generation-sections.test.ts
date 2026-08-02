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

  it("skips segmented LLM when outline already exists — single full-pack outline", () => {
    expect(resolvePro2HubScriptGenerationSections("## 第一集\n…")).toEqual([
      "outline",
    ]);
    expect(
      resolvePro2HubScriptGenerationSections("## 第一集\n…", "default-master"),
    ).toEqual(["outline"]);
  });

  it("gu-feng with outline uses single DeepSeek full-pack outline call", () => {
    expect(
      resolvePro2HubScriptGenerationSections(
        "## 第一集\n3分钟",
        "gu-feng-tian-chong",
      ),
    ).toEqual(["outline"]);
  });
});
