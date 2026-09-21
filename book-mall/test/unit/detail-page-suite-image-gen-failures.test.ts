import { describe, expect, it } from "vitest";

import {
  formatDetailPageSuiteImageGenFailureLine,
  mergeDetailPageSuiteImageGenFailures,
  parseDetailPageSuiteImageGenFailureLine,
  readDetailPageSuiteImageGenFailures,
} from "@/lib/ecom/detail-page-suite/image-gen-failures";

describe("detail-page-suite image gen failures", () => {
  it("merges and clears failure entries", () => {
    const key = "m1::item_a";
    const merged = mergeDetailPageSuiteImageGenFailures(
      null,
      { [key]: { message: "timeout", failedAt: "2026-01-01T00:00:00.000Z" } },
    );
    expect(readDetailPageSuiteImageGenFailures(merged)[key]?.message).toBe("timeout");
    const cleared = mergeDetailPageSuiteImageGenFailures(merged, {}, [key]);
    expect(readDetailPageSuiteImageGenFailures(cleared)[key]).toBeUndefined();
  });

  it("formats and parses failure lines", () => {
    const line = formatDetailPageSuiteImageGenFailureLine("m1::item_a", "Gateway 500");
    expect(parseDetailPageSuiteImageGenFailureLine(line)).toEqual({
      key: "item_a",
      message: "Gateway 500",
    });
  });

  it("prefers item label in failure line", () => {
    const line = formatDetailPageSuiteImageGenFailureLine("m1::item_a", "timeout", {
      itemLabel: "防风拉链特写",
    });
    expect(line).toBe("防风拉链特写: timeout");
  });
});
