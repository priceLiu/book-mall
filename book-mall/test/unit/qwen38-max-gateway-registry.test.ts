import { describe, expect, it } from "vitest";

import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";
import { gatewayRouteDisplayName } from "@/lib/gateway/gateway-model-capabilities";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  CANVAS_SCENE_MODEL_KEYS,
  ECOM_SCENE_MODEL_KEYS,
} from "@/lib/platform-model/model-ops-seed-config";
import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import { STORY_LLM_DEFAULT_VISION_MODEL } from "@/lib/canvas/story-llm-vision-models";

describe("qwen3.8-max Gateway All-in-One", () => {
  it("registers BAILIAN CHAT on the canonical registry for all apps", () => {
    const def = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "qwen3.8-max",
    );
    expect(def).toBeDefined();
    expect(def?.role).toBe("LLM");
    expect(def?.requestKind).toBe("CHAT");
    expect(def?.appTags).toEqual(
      expect.arrayContaining([
        "canvas",
        "story",
        "ecom",
        "quick-replica",
        "tool",
        "prompt-optimizer",
      ]),
    );
    expect(def?.description).toMatch(/文本生成/);
    expect(def?.description).toMatch(/图片理解/);
    expect(def?.description).toMatch(/视频理解/);
    expect(def?.routes).toEqual([
      { vendor: "aliyun", modelKey: "qwen3.8-max", providerKind: "BAILIAN" },
    ]);
  });

  it("routes to Bailian chat", () => {
    expect(routeGatewayModel("qwen3.8-max")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "CHAT",
    });
  });

  it("uses All-in-One display name for Gateway / 平台代付清单", () => {
    expect(
      gatewayRouteDisplayName(
        { displayName: "Qwen3.8 Max", canonicalKey: "qwen3.8-max" },
        "qwen3.8-max",
      ),
    ).toBe("Qwen3.8 Max · 文本/视觉/视频理解");
  });

  it("is on canvas LLM and ecom chat scene shelves", () => {
    expect(CANVAS_SCENE_MODEL_KEYS["pro2-llm"]).toContain("qwen3.8-max");
    expect(ECOM_SCENE_MODEL_KEYS["ecom-storyboard-chat"]).toContain("qwen3.8-max");
  });

  it("is the default vision model and listed in Bailian chat fallback", () => {
    expect(STORY_LLM_DEFAULT_VISION_MODEL).toBe("qwen3.8-max");
    expect(BAILIAN_CHAT_KNOWN_MODELS.map((m) => m.modelKey)).toContain("qwen3.8-max");
  });
});
