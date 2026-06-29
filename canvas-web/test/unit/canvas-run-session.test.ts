import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clearCanvasNodeRunSession,
  markCanvasNodeRunSession,
  shouldDeferLibtvOrphanReconcile,
} from "@/lib/canvas/canvas-run-session";

describe("canvas-run-session", () => {
  afterEach(() => {
    clearCanvasNodeRunSession("node-a");
  });

  it("defers orphan reconcile while run session is within grace window", () => {
    vi.useFakeTimers();
    markCanvasNodeRunSession("node-a");
    expect(shouldDeferLibtvOrphanReconcile("node-a")).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(shouldDeferLibtvOrphanReconcile("node-a")).toBe(true);
    vi.advanceTimersByTime(100_000);
    expect(shouldDeferLibtvOrphanReconcile("node-a")).toBe(false);
    vi.useRealTimers();
  });

  it("does not defer for nodes without an active session", () => {
    expect(shouldDeferLibtvOrphanReconcile("node-b")).toBe(false);
  });
});
