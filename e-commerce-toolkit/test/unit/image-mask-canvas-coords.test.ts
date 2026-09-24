import { describe, expect, it } from "vitest";

import { clientPointToCanvasBitmap } from "@/lib/image-mask-canvas-coords";

const origin = { left: 0, top: 0, width: 200, height: 100 };

describe("clientPointToCanvasBitmap", () => {
  it("maps 1:1 when CSS size equals bitmap size", () => {
    expect(
      clientPointToCanvasBitmap(40, 25, origin, 200, 100),
    ).toEqual({ x: 40, y: 25 });
  });

  it("scales into bitmap when CSS is larger than canvas attributes", () => {
    expect(
      clientPointToCanvasBitmap(200, 100, origin, 100, 50),
    ).toEqual({ x: 100, y: 50 });
    expect(
      clientPointToCanvasBitmap(100, 50, origin, 100, 50),
    ).toEqual({ x: 50, y: 25 });
  });

  it("reaches the bitmap corner when CSS is smaller than canvas attributes", () => {
    expect(
      clientPointToCanvasBitmap(200, 100, origin, 400, 200),
    ).toEqual({ x: 400, y: 200 });
  });

  it("clamps points outside the CSS box to the canvas edge", () => {
    expect(
      clientPointToCanvasBitmap(240, 140, origin, 100, 50),
    ).toEqual({ x: 100, y: 50 });
    expect(
      clientPointToCanvasBitmap(-20, -10, origin, 100, 50),
    ).toEqual({ x: 0, y: 0 });
  });

  it("returns origin when sizes are invalid", () => {
    expect(
      clientPointToCanvasBitmap(10, 10, { left: 0, top: 0, width: 0, height: 10 }, 100, 50),
    ).toEqual({ x: 0, y: 0 });
  });
});
