import { describe, expect, it, vi } from "vitest";

import {
  QUEUE_SLOT_BASE_MS,
  queueDispatchAfterFromIndex,
} from "@/lib/generation/traffic-control/queue-dispatch-after";

describe("queueDispatchAfterFromIndex", () => {
  it("index 0 (queue head) is immediately dispatchable, no jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const d = queueDispatchAfterFromIndex(0, 1_000_000);
    expect(d.getTime()).toBe(1_000_000);
    // 即便 random 接近 1，队首也不应被抖动推后
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const d2 = queueDispatchAfterFromIndex(0, 1_000_000);
    expect(d2.getTime()).toBe(1_000_000);
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
