import { describe, expect, it } from "vitest";

import { BAILIAN_IMAGE_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-image";
import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";
import { marketTaskTagsForModel } from "@/lib/gateway/gateway-model-capabilities";
import { CANVAS_SCENE_MODEL_KEYS } from "@/lib/platform-model/model-ops-seed-config";
import { routeGatewayModel } from "@/lib/gateway/model-router";

const IMAGE_EDIT_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wan2.7-image-pro",
  "wan2.6-image",
  "google/nano-banana-edit",
] as const;

describe("Gateway image-edit models", () => {
  it("registers dedicated image-edit modelKeys in the canonical registry", () => {
    const routeKeys = new Set(
      GATEWAY_CANONICAL_REGISTRY.flatMap((c) => c.routes.map((r) => r.modelKey)),
    );
    for (const key of IMAGE_EDIT_MODEL_KEYS) {
      expect(routeKeys.has(key), key).toBe(true);
    }
  });

  it("lists Qwen / Wan image-edit models on the Bailian image catalog", () => {
    const keys = new Set(BAILIAN_IMAGE_KNOWN_MODELS.map((m) => m.modelKey));
    expect(keys.has("qwen-image-edit")).toBe(true);
    expect(keys.has("qwen-image-edit-max")).toBe(true);
    expect(keys.has("wan2.6-image")).toBe(true);
    expect(keys.has("wan2.7-image-pro")).toBe(true);
  });

  it("routes wan2.7-image-pro to DashScope IMAGE", () => {
    expect(routeGatewayModel("wan2.7-image-pro")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
    });
  });

  it("routes image-edit models to DashScope / KIE IMAGE", () => {
    expect(routeGatewayModel("qwen-image-edit")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
    });
    expect(routeGatewayModel("qwen-image-edit-max")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
    });
    expect(routeGatewayModel("wan2.6-image")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
    });
    expect(routeGatewayModel("google/nano-banana-edit")).toEqual({
      providerKind: "KIE",
      requestKind: "IMAGE",
    });
  });

  it("tags Qwen image-edit as image-to-image only", () => {
    expect(
      marketTaskTagsForModel({
        canonicalKey: "qwen-image-edit",
        mediaKind: "TEXT_TO_IMAGE",
        requestKind: "IMAGE",
        role: "IMAGE",
        modelKey: "qwen-image-edit",
      }),
    ).toEqual(["image-to-image"]);
  });

  it("puts image-edit models on canvas Pro2 / sbv1 image shelves", () => {
    for (const key of IMAGE_EDIT_MODEL_KEYS) {
      expect(CANVAS_SCENE_MODEL_KEYS["pro2-image"]).toContain(key);
      expect(CANVAS_SCENE_MODEL_KEYS["sbv1-image"]).toContain(key);
    }
  });
});
