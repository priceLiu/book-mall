import { describe, expect, it } from "vitest";

import type { CanvasProviderDto } from "@/lib/canvas/canvas-provider-service";
import { GATEWAY_BAILIAN_PROVIDER_ID } from "@/lib/canvas/canvas-gateway-providers";
import { mergeKnownBailianImageModelsForCanvas } from "@/lib/canvas/canvas-registry-providers";

function shell(id: string): Omit<CanvasProviderDto, "models"> {
  const now = new Date().toISOString();
  return {
    id,
    alias: id,
    kind: "OPENAI_COMPAT",
    baseUrl: null,
    apiKeyMasked: "gateway",
    active: true,
    lastTestedAt: null,
    lastTestStatus: "gateway",
    createdAt: now,
    updatedAt: now,
  };
}

describe("mergeKnownBailianImageModelsForCanvas", () => {
  it("appends qwen-image-3.0-pro when registry list omitted it", () => {
    const providers: CanvasProviderDto[] = [
      {
        ...shell(GATEWAY_BAILIAN_PROVIDER_ID),
        models: [
          {
            id: `${GATEWAY_BAILIAN_PROVIDER_ID}::wan2.7-image`,
            modelKey: "wan2.7-image",
            displayName: "万相 2.7",
            role: "IMAGE",
            description: null,
            paramsSchema: null,
            defaultParams: null,
            enabled: true,
            sortOrder: 0,
          },
        ],
      },
    ];

    const merged = mergeKnownBailianImageModelsForCanvas(providers, {
      role: "IMAGE",
    });
    const bailian = merged.find((p) => p.id === GATEWAY_BAILIAN_PROVIDER_ID);
    expect(bailian?.models.some((m) => m.modelKey === "qwen-image-3.0-pro")).toBe(
      true,
    );
  });

  it("creates bailian provider when list was empty", () => {
    const merged = mergeKnownBailianImageModelsForCanvas([], { role: "IMAGE" });
    const bailian = merged.find((p) => p.id === GATEWAY_BAILIAN_PROVIDER_ID);
    expect(bailian?.active).toBe(true);
    expect(bailian?.models.some((m) => m.modelKey === "qwen-image-3.0-pro")).toBe(
      true,
    );
  });

  it("skips merge for non-IMAGE role filter", () => {
    const merged = mergeKnownBailianImageModelsForCanvas([], { role: "VIDEO" });
    expect(merged).toEqual([]);
  });
});
