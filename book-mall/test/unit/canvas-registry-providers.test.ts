import { describe, expect, it } from "vitest";

import type { CanvasProviderDto } from "@/lib/canvas/canvas-provider-service";
import {
  GATEWAY_BAILIAN_PROVIDER_ID,
  GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
} from "@/lib/canvas/canvas-gateway-providers";
import {
  mergeKnownBailianImageModelsForCanvas,
  mergeKnownMinimaxSpeechModelsForCanvas,
} from "@/lib/canvas/canvas-registry-providers";

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

describe("mergeKnownMinimaxSpeechModelsForCanvas", () => {
  it("appends MiniMax Speech when registry list omitted it", () => {
    const providers: CanvasProviderDto[] = [
      {
        ...shell(GATEWAY_MINIMAX_VIDEO_PROVIDER_ID),
        models: [],
      },
    ];

    const merged = mergeKnownMinimaxSpeechModelsForCanvas(providers, {
      role: "TTS",
    });
    const minimax = merged.find((p) => p.id === GATEWAY_MINIMAX_VIDEO_PROVIDER_ID);
    expect(minimax?.models.some((m) => m.modelKey === "MiniMax/speech-2.8-hd")).toBe(
      true,
    );
    expect(
      minimax?.models.find((m) => m.modelKey === "MiniMax/speech-2.8-hd")?.defaultParams,
    ).toMatchObject({ voice_id: "male-qn-qingse" });
  });

  it("creates minimax provider when list was empty", () => {
    const merged = mergeKnownMinimaxSpeechModelsForCanvas([], { role: "LLM" });
    const minimax = merged.find((p) => p.id === GATEWAY_MINIMAX_VIDEO_PROVIDER_ID);
    expect(minimax?.active).toBe(true);
    expect(minimax?.models.length).toBeGreaterThan(0);
  });

  it("skips merge for unrelated role filter", () => {
    const merged = mergeKnownMinimaxSpeechModelsForCanvas([], { role: "VIDEO" });
    expect(merged).toEqual([]);
  });
});
