import { describe, expect, it } from "vitest";

import { canvasSavePhaseLabel } from "@/lib/canvas/canvas-save-phase";

describe("canvasSavePhaseLabel", () => {
  it("shows step-specific busy labels", () => {
    expect(canvasSavePhaseLabel("patch_delta")).toBe("增量保存中…");
    expect(canvasSavePhaseLabel("patch_full")).toBe("整图保存中…");
    expect(canvasSavePhaseLabel("retry", 2)).toBe("保存重试中 (2/2)…");
    expect(canvasSavePhaseLabel("sync_version")).toBe("同步画布版本…");
  });

  it("returns empty for idle and saved for done", () => {
    expect(canvasSavePhaseLabel("idle")).toBe("");
    expect(canvasSavePhaseLabel("done")).toBe("已保存");
  });
});
