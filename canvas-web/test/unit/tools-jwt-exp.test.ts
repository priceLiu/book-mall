import { describe, expect, it } from "vitest";
import {
  isToolsJwtExpired,
  shouldRefreshToolsJwt,
  toolsJwtSecondsUntilExpiry,
} from "@/lib/tools-jwt-exp";

function jwtWithExp(expSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ sub: "u1", exp: expSec })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

describe("tools-jwt-exp", () => {
  it("detects expired token with skew", () => {
    const exp = Math.floor(Date.now() / 1000) + 20;
    expect(isToolsJwtExpired(jwtWithExp(exp))).toBe(true);
  });

  it("should refresh when within proactive window", () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(shouldRefreshToolsJwt(jwtWithExp(exp))).toBe(true);
  });

  it("should not refresh when plenty of TTL remains", () => {
    const exp = Math.floor(Date.now() / 1000) + 400;
    expect(shouldRefreshToolsJwt(jwtWithExp(exp))).toBe(false);
  });

  it("reports seconds until expiry", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const left = toolsJwtSecondsUntilExpiry(jwtWithExp(exp));
    expect(left).toBeGreaterThanOrEqual(299);
    expect(left).toBeLessThanOrEqual(300);
  });
});
