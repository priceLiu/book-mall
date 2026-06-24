import { describe, expect, it, vi } from "vitest";

import {
  QUEUE_SLOT_BASE_MS,
  QUEUE_SLOT_JITTER_MS,
  queueDispatchAfterFromIndex,
} from "@/lib/generation/traffic-control/queue-dispatch-after";

describe("queueDispatchAfterFromIndex", () => {
  it("index 0 is within jitter only", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const d = queueDispatchAfterFromIndex(0, 1_000_000);
    expect(d.getTime()).toBe(1_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const d2 = queueDispatchAfterFromIndex(0, 1_000_000);
    expect(d2.getTime()).toBeGreaterThanOrEqual(1_000_000 + QUEUE_SLOT_JITTER_MS - 3);
    expect(d2.getTime()).toBeLessThanOrEqual(1_000_000 + QUEUE_SLOT_JITTER_MS);
    vi.restoreAllMocks();
  });

  it("index 7 adds 7 slot bases plus jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const d = queueDispatchAfterFromIndex(7, 0);
    expect(d.getTime()).toBe(7 * QUEUE_SLOT_BASE_MS);
    vi.restoreAllMocks();
  });

  it("later index is never earlier than earlier index with same jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = queueDispatchAfterFromIndex(2, 100).getTime();
    const b = queueDispatchAfterFromIndex(5, 100).getTime();
    expect(b).toBeGreaterThan(a);
    vi.restoreAllMocks();
  });
});
