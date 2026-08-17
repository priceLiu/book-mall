import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  issueAdminTopupVerifyToken,
  verifyAdminTopupVerifyToken,
} from "@/lib/payments/admin-topup-verify-token";

describe("admin-topup-verify-token", () => {
  const prev = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-admin-topup";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = prev;
  });

  it("issues and verifies token for matching user and pack", () => {
    const token = issueAdminTopupVerifyToken("user-1", "video-pack-admin-5000");
    expect(verifyAdminTopupVerifyToken(token, "user-1", "video-pack-admin-5000")).toBe(true);
    expect(verifyAdminTopupVerifyToken(token, "user-2", "video-pack-admin-5000")).toBe(false);
    expect(verifyAdminTopupVerifyToken(token, "user-1", "other-pack")).toBe(false);
  });
});
