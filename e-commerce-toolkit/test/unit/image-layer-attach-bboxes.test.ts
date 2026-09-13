import { describe, expect, it } from "vitest";

import { attachPendingBboxesToStack } from "@/lib/image-layer-attach-bboxes";
import type { ImageLayerStack } from "@/lib/image-layer-types";

describe("attachPendingBboxesToStack", () => {
  it("attaches pending bbox when layer lacks metadata", () => {
    const stack: ImageLayerStack = {
      background: {
        id: "bg",
        url: "https://example.com/bg.png",
        zIndex: 0,
        isBackground: true,
      },
      layers: [
        {
          id: "obj",
          url: "https://example.com/obj.png",
          zIndex: 1,
          isBackground: false,
        },
      ],
    };
    const out = attachPendingBboxesToStack(stack, [[100, 200, 400, 800]]);
    expect(out.layers[0]?.bbox?.normalized).toEqual([100, 200, 400, 800]);
  });
});
