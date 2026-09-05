import { describe, expect, it } from "vitest";

import { isDashscopeAsrNoSpeechOutcome } from "@/lib/gateway/dashscope-client";

describe("isDashscopeAsrNoSpeechOutcome", () => {
  it("detects SUCCESS_WITH_NO_VALID_FRAGMENT", () => {
    expect(
      isDashscopeAsrNoSpeechOutcome(
        "SUCCESS_WITH_NO_VALID_FRAGMENT",
        null,
        null,
      ),
    ).toBe(true);
  });

  it("detects code on failed status", () => {
    expect(
      isDashscopeAsrNoSpeechOutcome("FAILED", "NO_VALID_FRAGMENT", null),
    ).toBe(true);
  });

  it("returns false for normal failures", () => {
    expect(isDashscopeAsrNoSpeechOutcome("FAILED", "INTERNAL_ERROR", null)).toBe(
      false,
    );
  });

  it("matches error string from gateway 502 body", () => {
    expect(
      isDashscopeAsrNoSpeechOutcome(
        undefined,
        "SUCCESS_WITH_NO_VALID_FRAGMENT",
        "SUCCESS_WITH_NO_VALID_FRAGMENT",
      ),
    ).toBe(true);
  });
});
