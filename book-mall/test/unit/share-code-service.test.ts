import { describe, expect, it } from "vitest";

import {
  buildShareCodePageUrl,
  isValidShareCodeCharset,
  normalizeShareCode,
  REFERRAL_CODE_LENGTH,
  WORKFLOW_CODE_LENGTH,
} from "@/lib/share/share-code-alphabet";
import { matchShareCodePrefix } from "@/lib/share/share-code-service";

describe("share-code-alphabet", () => {
  it("normalizeShareCode trims and uppercases", () => {
    expect(normalizeShareCode(" rk12ab34 ")).toBe("RK12AB34");
    expect(normalizeShareCode("ab-cd_ef")).toBe("ABCDEF");
  });

  it("rejects invalid charset", () => {
    expect(isValidShareCodeCharset("RK12IO34")).toBe(false);
    expect(isValidShareCodeCharset("RK23AB3H")).toBe(true);
  });

  it("buildShareCodePageUrl", () => {
    expect(buildShareCodePageUrl("https://book.example.com", "RK23AB3H")).toBe(
      "https://book.example.com/code/RK23AB3H",
    );
  });
});

describe("matchShareCodePrefix", () => {
  it("matches referral 8-char codes", () => {
    expect(
      matchShareCodePrefix("RK23AB3H", "RK", "REFERRAL", REFERRAL_CODE_LENGTH),
    ).toBe(true);
    expect(
      matchShareCodePrefix("RK23AB3H", "CV", "REFERRAL", REFERRAL_CODE_LENGTH),
    ).toBe(false);
  });

  it("matches workflow 10-char codes", () => {
    expect(
      matchShareCodePrefix("CVAS23AB3H", "CVAS", "WORKFLOW", WORKFLOW_CODE_LENGTH),
    ).toBe(true);
    expect(
      matchShareCodePrefix("CVAS23AB3H", "CVA", "WORKFLOW", WORKFLOW_CODE_LENGTH),
    ).toBe(false);
  });
});
