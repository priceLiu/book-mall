import { describe, expect, it } from "vitest";

import {
  readTrafficStartedAtIso,
  withTrafficStartedAtPayload,
} from "@/lib/generation/traffic-control/traffic-timing";

describe("traffic-timing", () => {
  it("withTrafficStartedAtPayload 首次写入、重排保留", () => {
    const first = withTrafficStartedAtPayload({}, 1_000_000);
    expect(first.trafficStartedAt).toBe("1970-01-01T00:16:40.000Z");

    const again = withTrafficStartedAtPayload(
      { ...first, dispatchStaleRetryCount: 2 },
      9_000_000,
    );
    expect(again.trafficStartedAt).toBe("1970-01-01T00:16:40.000Z");
    expect(again.dispatchStaleRetryCount).toBe(2);
  });

  it("readTrafficStartedAtIso 回退 createdAt", () => {
    expect(
      readTrafficStartedAtIso(null, "2026-06-25T00:00:00.000Z"),
    ).toBe("2026-06-25T00:00:00.000Z");
  });
});
