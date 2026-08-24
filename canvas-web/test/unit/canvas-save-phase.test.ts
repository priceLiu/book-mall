import { describe, expect, it } from "vitest";

import {
  CANVAS_AUTOSAVE_RECONNECT_HINT,
  canvasSavePhaseLabel,
  formatCanvasAutosaveUserHint,
  isCanvasAutosaveReconnectError,
} from "@/lib/canvas/canvas-save-phase";

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

describe("formatCanvasAutosaveUserHint", () => {
  it("shows reconnect hint for transient save timeout", () => {
    expect(isCanvasAutosaveReconnectError("save_timeout")).toBe(true);
    expect(
      formatCanvasAutosaveUserHint("save_timeout"),
    ).toBe(CANVAS_AUTOSAVE_RECONNECT_HINT);
  });

  it("shows short message for non-transient errors", () => {
    expect(
      formatCanvasAutosaveUserHint("INVALID_INPUT something"),
    ).toBe("INVALID_INPUT something");
  });
});
