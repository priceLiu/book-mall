import { describe, expect, it } from "vitest";

import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";
import { marketTaskTagsForModel } from "@/lib/gateway/gateway-model-capabilities";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  CANVAS_SCENE_MODEL_KEYS,
  ECOM_SCENE_MODEL_KEYS,
  QUICK_REPLICA_SCENE_MODEL_KEYS,
} from "@/lib/platform-model/model-ops-seed-config";
import { STORYBOARD_VIDEO_MODELS } from "@/lib/ecom/ecom-storyboard-video-models";
import { QR_TEXT_TO_VIDEO_MODELS } from "@/lib/quick-replica/qr-text-to-video-models";
import { BAILIAN_DASHSCOPE_T2V_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-dashscope-t2v";

describe("wan3.0-video Gateway All-in-One", () => {
  it("registers DASHSCOPE VIDEO on the canonical registry", () => {
    const def = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "wan3.0-video",
    );
    expect(def).toBeDefined();
    expect(def?.role).toBe("VIDEO");
    expect(def?.appTags).toEqual(
      expect.arrayContaining(["canvas", "story", "ecom", "quick-replica", "tool"]),
    );
    expect(def?.description).toMatch(/All-in-One/);
    expect(def?.routes).toEqual([
      { vendor: "aliyun", modelKey: "wan3.0-video", providerKind: "DASHSCOPE" },
    ]);
  });

  it("registers wan3.0-video-prime on the canonical registry", () => {
    const def = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "wan3.0-video-prime",
    );
    expect(def).toBeDefined();
    expect(def?.role).toBe("VIDEO");
    expect(def?.description).toMatch(/优速版/);
    expect(def?.routes).toEqual([
      { vendor: "aliyun", modelKey: "wan3.0-video-prime", providerKind: "DASHSCOPE" },
    ]);
  });

  it("routes to DashScope video (not Bailian R2V)", () => {
    expect(routeGatewayModel("wan3.0-video")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
    expect(routeGatewayModel("wan3.0-video-prime")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("tags as image-to-video for Gateway marketplace / 平台代付清单", () => {
    expect(
      marketTaskTagsForModel({
        canonicalKey: "wan3.0-video",
        mediaKind: "IMAGE_TO_VIDEO",
        requestKind: "VIDEO",
        role: "VIDEO",
        modelKey: "wan3.0-video",
      }),
    ).toEqual(["image-to-video"]);
    expect(
      marketTaskTagsForModel({
        canonicalKey: "wan3.0-video-prime",
        mediaKind: "IMAGE_TO_VIDEO",
        requestKind: "VIDEO",
        role: "VIDEO",
        modelKey: "wan3.0-video-prime",
      }),
    ).toEqual(["image-to-video"]);
  });

  it("is on canvas / ecom / QuickReplica scene shelves", () => {
    for (const key of ["wan3.0-video", "wan3.0-video-prime"] as const) {
      expect(CANVAS_SCENE_MODEL_KEYS["pro2-video"]).toContain(key);
      expect(CANVAS_SCENE_MODEL_KEYS["sbv1-video"]).toContain(key);
      expect(ECOM_SCENE_MODEL_KEYS["ecom-storyboard-video"]).toContain(key);
      expect(QUICK_REPLICA_SCENE_MODEL_KEYS["qr-t2v"]).toContain(key);
    }
  });

  it("wan2.7-r2v and kling motion-control are on ecom-outfit-video shelf", () => {
    expect(ECOM_SCENE_MODEL_KEYS["ecom-outfit-video"]).toContain("wan2.7-r2v");
    expect(ECOM_SCENE_MODEL_KEYS["ecom-outfit-video"]).toContain("happyhorse-1.1-r2v");
    expect(ECOM_SCENE_MODEL_KEYS["ecom-outfit-video"]).toContain("kling-3.0/motion-control");
  });

  it("is selectable in ecom storyboard and QuickReplica catalogs", () => {
    for (const key of ["wan3.0-video", "wan3.0-video-prime"] as const) {
      expect(STORYBOARD_VIDEO_MODELS).toContain(key);
      expect(QR_TEXT_TO_VIDEO_MODELS.map((m) => m.modelKey)).toContain(key);
      expect(BAILIAN_DASHSCOPE_T2V_KNOWN_MODELS.map((m) => m.modelKey)).toContain(
        key,
      );
    }
  });
});
