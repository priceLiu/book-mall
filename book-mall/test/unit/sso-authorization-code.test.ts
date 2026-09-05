import { describe, expect, it } from "vitest";

import {
  SSO_EXCHANGE_REPLAY_GRACE_MS,
  isSsoAuthorizationCodeReplayAllowed,
} from "@/lib/sso-authorization-code";

describe("isSsoAuthorizationCodeReplayAllowed", () => {
  const now = new Date("2026-08-28T05:00:00.000Z");

  it("allows replay within grace after consume", () => {
    expect(
      isSsoAuthorizationCodeReplayAllowed(
        {
          consumedAt: new Date(now.getTime() - 30_000),
          expiresAt: new Date(now.getTime() + 60_000),
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects replay after grace", () => {
    expect(
      isSsoAuthorizationCodeReplayAllowed(
        {
          consumedAt: new Date(
            now.getTime() - SSO_EXCHANGE_REPLAY_GRACE_MS - 1,
          ),
          expiresAt: new Date(now.getTime() + 60_000),
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects unconsumed code", () => {
    expect(
      isSsoAuthorizationCodeReplayAllowed(
        {
          consumedAt: null,
          expiresAt: new Date(now.getTime() + 60_000),
        },
        now,
      ),
    ).toBe(false);
  });
});
