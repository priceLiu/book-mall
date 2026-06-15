import { describe, expect, it } from "vitest";

import { resolveGatewayUserEmail } from "@/lib/gateway/sync-user";

describe("resolveGatewayUserEmail", () => {
  it("prefers real email", () => {
    expect(
      resolveGatewayUserEmail({ email: "User@Example.com", phone: "13800138000" }),
    ).toBe("user@example.com");
  });

  it("falls back to phone.book for phone-only users", () => {
    expect(resolveGatewayUserEmail({ phone: "67890654546" })).toBe(
      "67890654546@phone.book",
    );
  });

  it("returns null when neither email nor phone", () => {
    expect(resolveGatewayUserEmail({})).toBeNull();
    expect(resolveGatewayUserEmail({ email: "  ", phone: "" })).toBeNull();
  });
});
