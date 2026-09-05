import { describe, expect, it } from "vitest";

import {
  assertStoryLlmVideoUnderstandingModel,
  isStoryLlmVideoUnderstandingModel,
  STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS,
} from "@/lib/canvas/story-llm-vision-models";
import { gatewayRouteDisplayName } from "@/lib/gateway/gateway-model-capabilities";
import {
  resolveBailianChatModelKey,
  routeGatewayModel,
} from "@/lib/gateway/model-router";
import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";
import {
  CANVAS_SCENE_MODEL_KEYS,
  ECOM_SCENE_MODEL_KEYS,
} from "@/lib/platform-model/model-ops-seed-config";
import { GATEWAY_ALI_PRICE_BY_MODEL_KEY } from "@/lib/pricing/gateway-bailian-price-catalog";

const NEW_VIDEO_MODELS = [
  "qwen3-omni-flash",
  "qwen2.5-vl-72b-instruct",
  "glm-5.3-flash",
] as const;

describe("video understanding models · Gateway registry", () => {
  for (const modelKey of NEW_VIDEO_MODELS) {
    it(`registers ${modelKey} on canonical registry`, () => {
      const def = GATEWAY_CANONICAL_REGISTRY.find(
        (c) => c.canonicalModelKey === modelKey,
      );
      expect(def).toBeDefined();
      expect(def?.role).toBe("LLM");
      expect(def?.requestKind).toBe("CHAT");
      expect(def?.appTags).toEqual(expect.arrayContaining(["canvas", "ecom"]));
      expect(def?.routes.some((r) => r.providerKind === "BAILIAN")).toBe(true);
    });

    it(`routes ${modelKey} to Bailian chat`, () => {
      expect(routeGatewayModel(modelKey)).toEqual({
        providerKind: "BAILIAN",
        requestKind: "CHAT",
      });
    });
  }

  it("maps glm-5.3-flash alias to ZHIPU upstream id", () => {
    expect(resolveBailianChatModelKey("glm-5.3-flash")).toBe(
      "ZHIPU/GLM-5.3-Flash",
    );
  });

  it("includes models in video understanding whitelist", () => {
    for (const modelKey of NEW_VIDEO_MODELS) {
      expect(isStoryLlmVideoUnderstandingModel(modelKey)).toBe(true);
      expect(STORY_LLM_VIDEO_UNDERSTANDING_MODEL_KEYS).toContain(modelKey);
      expect(() => assertStoryLlmVideoUnderstandingModel(modelKey)).not.toThrow();
    }
  });

  it("is on canvas pro2-llm and ecom chat shelves", () => {
    for (const modelKey of NEW_VIDEO_MODELS) {
      expect(CANVAS_SCENE_MODEL_KEYS["pro2-llm"]).toContain(modelKey);
      expect(ECOM_SCENE_MODEL_KEYS["ecom-storyboard-chat"]).toContain(modelKey);
      expect(ECOM_SCENE_MODEL_KEYS["ecom-model-shot-chat"]).toContain(modelKey);
      expect(ECOM_SCENE_MODEL_KEYS["ecom-media-decompose-chat"]).toContain(modelKey);
      expect(ECOM_SCENE_MODEL_KEYS["ecom-film-pull-chat"]).toContain(modelKey);
    }
  });

  it("lists models in Bailian chat fallback catalog", () => {
    const keys = BAILIAN_CHAT_KNOWN_MODELS.map((m) => m.modelKey);
    for (const modelKey of NEW_VIDEO_MODELS) {
      expect(keys).toContain(modelKey);
    }
  });

  it("has bailian price catalog entries", () => {
    expect(GATEWAY_ALI_PRICE_BY_MODEL_KEY["qwen3-omni-flash"]).toMatchObject({
      inputYuanPerMillion: 1.8,
      outputYuanPerMillion: 15.8,
    });
    expect(GATEWAY_ALI_PRICE_BY_MODEL_KEY["qwen2.5-vl-72b-instruct"]).toMatchObject({
      inputYuanPerMillion: 16,
      outputYuanPerMillion: 48,
    });
    expect(GATEWAY_ALI_PRICE_BY_MODEL_KEY["glm-5.3-flash"]).toMatchObject({
      inputYuanPerMillion: 0.8,
      outputYuanPerMillion: 2.8,
    });
  });

  it("uses vision display names for Gateway catalog", () => {
    expect(
      gatewayRouteDisplayName(
        { displayName: "GLM-5.3 Flash", canonicalKey: "glm-5.3-flash" },
        "glm-5.3-flash",
      ),
    ).toBe("GLM-5.3 Flash · 图片/视频/文件理解");
  });
});
