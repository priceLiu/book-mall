import { describe, expect, it } from "vitest";

import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  buildVolcengineSeedreamImageCall,
  isVolcengineSeedreamImageModelKey,
} from "@/lib/gateway/volcengine-chat-models";

describe("Volcengine Seedream 5.0 canvas routing", () => {
  it("routes doubao-seedream-5-0-lite to VOLCENGINE IMAGE (not KIE)", () => {
    expect(isVolcengineSeedreamImageModelKey("doubao-seedream-5-0-lite")).toBe(
      true,
    );
    expect(isVolcengineSeedreamImageModelKey("seedream-5-lite")).toBe(false);
    expect(routeGatewayModel("doubao-seedream-5-0-lite")).toEqual({
      providerKind: "VOLCENGINE",
      requestKind: "IMAGE",
    });
  });

  it("builds 2K size and optional reference image", () => {
    expect(
      buildVolcengineSeedreamImageCall({
        prompt: "portrait",
        params: { resolution: "2K", n: 1 },
      }),
    ).toEqual({
      prompt: "portrait",
      parameters: { size: "2K", n: 1, watermark: false },
    });
    expect(
      buildVolcengineSeedreamImageCall({
        prompt: "edit",
        imageUrls: ["https://cdn.example/ref.png"],
        params: { resolution: "4K", n: 2 },
      }),
    ).toEqual({
      prompt: "edit",
      image: "https://cdn.example/ref.png",
      parameters: { size: "4K", n: 2, watermark: false },
    });
  });
});
