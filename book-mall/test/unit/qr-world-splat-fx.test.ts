import { describe, expect, it } from "vitest";

import {
  computeRevealBounds,
  computeTransitionDurationMs,
  easeInOutCubic,
  MAX_TRANSITION_MS,
  MIN_TRANSITION_MS,
  TRANSITION_SPEED,
} from "../../../quick-replica-web/lib/qr-world-splat-fx";

describe("computeRevealBounds", () => {
  it("returns unit radius when no splats", () => {
    const bounds = computeRevealBounds({ numSplats: 0, getSplat: () => ({ center: { x: 0, y: 0, z: 0 } }) } as never, {
      Vector3: class {
        x = 0;
        y = 0;
        z = 0;
        set(x: number, y: number, z: number) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        }
      },
    } as never);
    expect(bounds.radius).toBe(1);
  });

  it("uses bbox center and max distance from center", () => {
    const centers = [
      { x: 10, y: 0, z: 0 },
      { x: 14, y: 0, z: 0 },
      { x: 12, y: 3, z: 0 },
    ];
    const bounds = computeRevealBounds(
      {
        numSplats: 3,
        getSplat: (i: number) => ({ center: centers[i]! }),
      } as never,
      {
        Vector3: class {
          x = 0;
          y = 0;
          z = 0;
          set(x: number, y: number, z: number) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
          }
        },
      } as never,
    );
    expect(bounds.center.x).toBeCloseTo(12);
    expect(bounds.center.y).toBeCloseTo(1.5);
    expect(bounds.radius).toBeCloseTo(2.5);
  });
});

describe("computeTransitionDurationMs", () => {
  it("uses OpenArt speed with min/max clamp", () => {
    expect(computeTransitionDurationMs(1)).toBe(MIN_TRANSITION_MS);
    expect(computeTransitionDurationMs(99999)).toBe(MAX_TRANSITION_MS);
    expect(TRANSITION_SPEED).toBe(133);
  });
});

describe("easeInOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
