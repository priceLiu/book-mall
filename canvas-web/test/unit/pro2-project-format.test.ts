import { describe, expect, it } from "vitest";
import {
  PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
  isActivePro2ScriptFormatV13,
  isRetiredLegacyPro2Canvas,
  isRetiredLegacyPro2FromListHints,
  pro2CanvasHasScriptUsage,
  pro2ProjectHasScriptUsageFromListHints,
  withPro2ScriptFormatV13Meta,
} from "@/lib/canvas/pro2-project-format";

describe("pro2-project-format", () => {
  it("detects script usage via hub node or linked package", () => {
    expect(
      pro2ProjectHasScriptUsageFromListHints({ edition: "pro2" }, [
        "story-pro2-script-hub",
      ]),
    ).toBe(true);
    expect(
      pro2ProjectHasScriptUsageFromListHints(
        { edition: "pro2", linkedScriptPackageAssetId: "asset-1" },
        ["story-pro2-starter"],
      ),
    ).toBe(true);
    expect(
      pro2ProjectHasScriptUsageFromListHints({ edition: "pro2" }, [
        "story-pro2-starter",
        "story-pro2-image",
      ]),
    ).toBe(false);
  });

  it("retires legacy pro2 only when script pipeline was used", () => {
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
    expect(
      isRetiredLegacyPro2Canvas({
        meta: { edition: "pro2" },
        nodes: [{ type: "story-pro2-starter" }],
      }),
    ).toBe(false);
    expect(
      isRetiredLegacyPro2Canvas({
        meta: { edition: "pro2" },
        nodes: [{ type: "story-pro2-script-hub" }],
      }),
    ).toBe(true);
    expect(pro2CanvasHasScriptUsage({ nodes: [] })).toBe(false);
  });

  it("keeps v13 pro2 projects active", () => {
    const meta = {
      edition: "pro2",
      pro2ScriptFormat: PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
    };
    expect(isActivePro2ScriptFormatV13(meta)).toBe(true);
    expect(
      isRetiredLegacyPro2FromListHints(meta, ["story-pro2-script-hub"]),
    ).toBe(false);
    expect(
      isRetiredLegacyPro2Canvas({
        meta,
        nodes: [{ type: "story-pro2-script-hub" }],
      }),
    ).toBe(false);
  });

  it("does not retire non-pro2 editions", () => {
    expect(
      isRetiredLegacyPro2FromListHints({ edition: "pro" }, ["story-pro-starter"]),
    ).toBe(false);
  });

  it("withPro2ScriptFormatV13Meta stamps meta on create", () => {
    const graph = withPro2ScriptFormatV13Meta({ nodes: [], edges: [] });
    expect(graph.meta).toMatchObject({
      edition: "pro2",
      pro2ScriptFormat: PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
    });
  });
});
