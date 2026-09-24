import { describe, expect, it } from "vitest";
import {
  assertCanvasNodeCountNotSuspiciouslyDropped,
  countCanvasGraphNodes,
} from "@/lib/canvas/canvas-node-count-guard";

describe("canvas-node-count-guard", () => {
  it("counts nodes", () => {
    expect(countCanvasGraphNodes({ nodes: [{ id: "a" }, { id: "b" }] })).toBe(2);
  });

  it("blocks large drop", () => {
    const prev = { nodes: Array.from({ length: 36 }, (_, i) => ({ id: `n${i}` })) };
    const next = { nodes: Array.from({ length: 6 }, (_, i) => ({ id: `g${i}` })) };
    const r = assertCanvasNodeCountNotSuspiciouslyDropped({
      previousCanvas: prev,
      nextCanvas: next,
    });
    expect(r.ok).toBe(false);
  });

  it("allows drop with flag", () => {
    const prev = { nodes: Array.from({ length: 36 }, (_, i) => ({ id: `n${i}` })) };
    const next = { nodes: [{ id: "a" }] };
    const r = assertCanvasNodeCountNotSuspiciouslyDropped({
      previousCanvas: prev,
      nextCanvas: next,
      allowSuspiciousNodeCountDrop: true,
    });
    expect(r.ok).toBe(true);
  });

  it("allows small graphs", () => {
    const r = assertCanvasNodeCountNotSuspiciouslyDropped({
      previousCanvas: { nodes: [{ id: "a" }] },
      nextCanvas: { nodes: [] },
    });
    expect(r.ok).toBe(true);
  });
});
