import { describe, expect, it } from "vitest";
import {
  PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
  isRetiredLegacyPro2FromListHints,
  withPro2ScriptFormatV13Meta,
} from "@/lib/canvas/pro2-project-format";

describe("pro2-project-format", () => {
  it("retires legacy pro2 only when script hub or linked package exists", () => {
    expect(
      isRetiredLegacyPro2FromListHints({ edition: "pro2" }, [
        "story-pro2-script-hub",
      ]),
    ).toBe(true);
    expect(
      isRetiredLegacyPro2FromListHints({ edition: "pro2" }, [
        "story-pro2-starter",
      ]),
    ).toBe(false);
    // 列表仅 meta、不传 nodeTypes 时无法识别 script-hub-only 退役项（须查 nodes）
    expect(
      isRetiredLegacyPro2FromListHints({ edition: "pro2" }, null),
    ).toBe(false);
    expect(
      isRetiredLegacyPro2FromListHints({}, ["story-pro2-script-hub"]),
    ).toBe(true);
  });

  it("withPro2ScriptFormatV13Meta stamps create meta", () => {
    const graph = withPro2ScriptFormatV13Meta({ nodes: [], edges: [] });
    expect(graph.meta).toMatchObject({
      edition: "pro2",
      pro2ScriptFormat: PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
    });
  });
});
