import { describe, expect, it } from "vitest";

import {
  formatUserDisplayLabel,
  phoneFromGatewayEmail,
} from "@/lib/auth/user-display";

describe("phoneFromGatewayEmail", () => {
  it("extracts phone from gateway email", () => {
    expect(phoneFromGatewayEmail("67890654546@phone.book")).toBe("67890654546");
  });

  it("returns null for real email", () => {
    expect(phoneFromGatewayEmail("user@example.com")).toBeNull();
  });
});

describe("formatUserDisplayLabel", () => {
  it("prefers name then phone", () => {
    expect(
      formatUserDisplayLabel({ name: "小明", phone: "13800138000", email: "a@b.com" }),
    ).toBe("小明");
    expect(formatUserDisplayLabel({ phone: "13800138000" })).toBe("13800138000");
  });

  it("uses phone from gateway email", () => {
    expect(formatUserDisplayLabel({ email: "67890111111@phone.book" })).toBe(
      "67890111111",
    );
  });
});
