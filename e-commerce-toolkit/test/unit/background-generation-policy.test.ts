import { describe, expect, it } from "vitest";

import {
  BACKGROUND_DOCK_PERSISTENT_MS,
  estimateBackgroundGenerationProgress,
  formatBackgroundGenerationAge,
  resolveBackgroundGenerationLabel,
} from "@/lib/generation/background-generation-policy";

describe("background-generation-policy", () => {
  it("formats age", () => {
    expect(formatBackgroundGenerationAge(45)).toBe("45s");
    expect(formatBackgroundGenerationAge(120)).toBe("2 分钟");
  });

  it("switches label after persistent threshold", () => {
    const start = Date.now() - BACKGROUND_DOCK_PERSISTENT_MS - 1000;
    expect(resolveBackgroundGenerationLabel(start)).toBe("持续后台生成中…");
    expect(resolveBackgroundGenerationLabel(Date.now())).toBe("生成中…");
  });

  it("caps pseudo progress below 1", () => {
    const start = Date.now() - 60_000;
    expect(
      estimateBackgroundGenerationProgress(start, 30_000, Date.now()),
    ).toBeLessThanOrEqual(0.95);
  });
});
