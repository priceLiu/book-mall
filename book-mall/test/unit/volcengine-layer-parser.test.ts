import { describe, expect, it } from "vitest";

import { parseSeedreamLayerDecomposeResponse } from "@/lib/gateway/volcengine-image-generations-proxy";

describe("parseSeedreamLayerDecomposeResponse", () => {
  it("parses data[] metadata", () => {
    const layers = parseSeedreamLayerDecomposeResponse({
      data: [
        {
          url: "https://example.com/bg.jpg",
          z_index: 0,
          name: "background",
        },
        {
          url: "https://example.com/layer.png",
          z_index: 1,
          bounding_box: { normalized: [10, 20, 90, 80] },
          name: "bag",
        },
      ],
    });
    expect(layers).toHaveLength(2);
    expect(layers[0]?.isBackground).toBe(true);
    expect(layers[1]?.bbox?.normalized).toEqual([10, 20, 90, 80]);
    expect(layers[1]?.name).toBe("bag");
  });
});
