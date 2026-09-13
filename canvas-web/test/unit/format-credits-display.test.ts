import { describe, expect, it } from "vitest";
import { formatCreditsDisplay } from "@/lib/canvas/format-credits-display";

describe("formatCreditsDisplay", () => {
  it("keeps integers without decimals", () => {
    expect(formatCreditsDisplay(3)).toBe("3");
  });

  it("keeps DeepSeek-scale fractional LLM estimates", () => {
    expect(formatCreditsDisplay(0.06)).toBe("0.06");
    expect(formatCreditsDisplay(0.01)).toBe("0.01");
  });

  it("does not round cheap LLM estimates to zero", () => {
    expect(formatCreditsDisplay(0.06)).not.toBe("0");
  });
});
