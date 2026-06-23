import { describe, expect, it } from "vitest";
import {
  computeTokenBurst,
  getActorDispatchMinMs,
  isGenerationInflightStatus,
  isTrafficControlEnabled,
} from "@/lib/generation/traffic-control/constants";
import { estimateWaitSec } from "@/lib/generation/traffic-control/queue-info";
import {
  buildTenantScopeKey,
  buildUserScopeKey,
  resolveTrafficScopeFromIds,
} from "@/lib/generation/traffic-control/scope-key";
import {
  refillTokenBucket,
  spacingBlocked,
} from "@/lib/generation/traffic-control/token-bucket";

describe("traffic-control constants", () => {
  it("inflight includes QUEUED and DISPATCHING", () => {
    expect(isGenerationInflightStatus("QUEUED")).toBe(true);
    expect(isGenerationInflightStatus("DISPATCHING")).toBe(true);
    expect(isGenerationInflightStatus("SUCCEEDED")).toBe(false);
  });

  it("TRAFFIC_CONTROL_OFF disables queue", () => {
    const prev = process.env.TRAFFIC_CONTROL_OFF;
    process.env.TRAFFIC_CONTROL_OFF = "1";
    expect(isTrafficControlEnabled()).toBe(false);
    process.env.TRAFFIC_CONTROL_OFF = prev;
  });
});

describe("scope-key", () => {
  it("team scope uses tenant id", () => {
    const s = resolveTrafficScopeFromIds({
      tenantId: "t1",
      userId: "u1",
      actorUserId: "u2",
    });
    expect(s.scopeKey).toBe(buildTenantScopeKey("t1"));
    expect(s.ownerType).toBe("TENANT");
  });

  it("personal scope uses actor user", () => {
    const s = resolveTrafficScopeFromIds({
      userId: "u1",
      actorUserId: "u2",
    });
    expect(s.scopeKey).toBe(buildUserScopeKey("u2"));
  });
});

describe("token-bucket", () => {
  it("refills tokens over time", () => {
    const now = Date.now();
    const tokens = refillTokenBucket(
      {
        dispatchTokens: 0,
        lastTokenRefillAt: new Date(now - 4000),
        maxConcurrency: 20,
        tokensPerSec: 0.5,
      },
      now,
    );
    expect(tokens).toBeGreaterThanOrEqual(1);
  });

  it("spacing blocks within actor dispatch min window (默认 1.2s)", () => {
    const now = Date.now();
    expect(spacingBlocked(new Date(now - 1000), now)).toBe(true);
    expect(spacingBlocked(new Date(now - 5000), now)).toBe(false);
    expect(getActorDispatchMinMs()).toBeGreaterThanOrEqual(1000);
  });

  it("queue wait estimate scales with position", () => {
    expect(estimateWaitSec(1)).toBe(0);
    expect(estimateWaitSec(4)).toBe(6);
  });

  it("burst scales with concurrency", () => {
    expect(computeTokenBurst(20)).toBeGreaterThanOrEqual(2);
  });
});
