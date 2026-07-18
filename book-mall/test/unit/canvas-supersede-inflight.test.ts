import { describe, expect, it } from "vitest";

import {
  storyScopeKey,
  storyScopesConflict,
} from "@/lib/canvas/canvas-story-scope";
import {
  CANVAS_SUPERSEDED_FAIL_CODE,
  CANVAS_SUPERSEDED_FAIL_MESSAGE,
} from "@/lib/canvas/canvas-supersede-inflight";

describe("canvas supersede inflight", () => {
  it("exports stable superseded fail metadata", () => {
    expect(CANVAS_SUPERSEDED_FAIL_CODE).toBe("SUPERSEDED");
    expect(CANVAS_SUPERSEDED_FAIL_MESSAGE).toContain("新的生成");
  });

  it("storyScopesConflict treats same node without scope as conflicting", () => {
    expect(storyScopesConflict(undefined, undefined)).toBe(true);
    expect(storyScopeKey(undefined)).toBe("");
  });

  it("storyScopesConflict isolates row-level scopes", () => {
    expect(
      storyScopesConflict({ rowKey: "a", mediaKind: "video" }, { rowKey: "b", mediaKind: "video" }),
    ).toBe(false);
    expect(
      storyScopesConflict({ rowKey: "a", mediaKind: "video" }, { rowKey: "a", mediaKind: "video" }),
    ).toBe(true);
  });
});
