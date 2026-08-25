import { describe, expect, it } from "vitest";

import {
  buildDashscopeKlingV3VideoBody,
  buildEcomStoryboardKling30DashscopeVideoJob,
  isDashscopeKlingV3VideoGatewayModel,
  KLING_V3_OMNI_VIDEO_MODEL,
  KLING_V3_VIDEO_MODEL,
  resolveDashscopeKlingV3UpstreamModel,
} from "@/lib/canvas/dashscope-kling-v3-video";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { resolveDashscopeVideoCreateUrl } from "@/lib/gateway/dashscope-client";

describe("dashscope-kling-v3-video", () => {
  it("detects gateway model keys", () => {
    expect(isDashscopeKlingV3VideoGatewayModel("kling-3.0/video")).toBe(true);
    expect(isDashscopeKlingV3VideoGatewayModel("kling/v3-turbo-text-to-video")).toBe(
      false,
    );
  });

  it("builds text-to-video body", () => {
    const body = buildDashscopeKlingV3VideoBody({
      prompt: "小猫奔跑",
      aspectRatio: "16:9",
      durationSec: 5,
      mode: "std",
      audio: false,
    });
    expect(body.input.prompt).toBe("小猫奔跑");
    expect(body.parameters).toMatchObject({
      mode: "std",
      duration: 5,
      audio: false,
      aspect_ratio: "16:9",
    });
    expect(body.input.media).toBeUndefined();
  });

  it("builds first/last frame i2v body", () => {
    const body = buildDashscopeKlingV3VideoBody({
      prompt: "动起来",
      firstFrameUrl: "https://example.com/a.jpg",
      lastFrameUrl: "https://example.com/b.jpg",
      durationSec: 8,
    });
    expect(body.input.media).toEqual([
      { type: "first_frame", url: "https://example.com/a.jpg" },
      { type: "last_frame", url: "https://example.com/b.jpg" },
    ]);
    expect(body.parameters.duration).toBe(8);
  });

  it("uses omni upstream when refer images present", () => {
    expect(
      resolveDashscopeKlingV3UpstreamModel({
        firstFrameUrl: "https://example.com/a.jpg",
        referImageUrls: ["https://example.com/ref.jpg"],
      }),
    ).toBe(KLING_V3_OMNI_VIDEO_MODEL);
    expect(
      resolveDashscopeKlingV3UpstreamModel({
        firstFrameUrl: "https://example.com/a.jpg",
      }),
    ).toBe(KLING_V3_VIDEO_MODEL);
  });

  it("builds ecom storyboard job with refer media", () => {
    const job = buildEcomStoryboardKling30DashscopeVideoJob({
      prompt: "产品展示",
      firstFrameUrl: "https://example.com/frame.jpg",
      references: [
        {
          id: "p1",
          label: "product",
          role: "product",
          ossUrl: "https://example.com/product.jpg",
        },
      ],
      aspectRatio: "9:16",
      durationSec: 6,
    });
    expect(job.model).toBe(KLING_V3_OMNI_VIDEO_MODEL);
    expect(job.videoBody.input.media).toEqual([
      { type: "first_frame", url: "https://example.com/frame.jpg" },
      { type: "refer", url: "https://example.com/product.jpg" },
    ]);
  });
});

describe("model-router kling video", () => {
  it("routes kling-3.0/video to DASHSCOPE VIDEO", () => {
    expect(routeGatewayModel("kling-3.0/video")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("keeps kling turbo on KIE", () => {
    expect(routeGatewayModel("kling/v3-turbo-text-to-video")).toEqual({
      providerKind: "KIE",
      requestKind: "VIDEO",
    });
  });

  it("keeps kling image on DASHSCOPE IMAGE", () => {
    expect(routeGatewayModel("kling-3.0-image")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
    });
  });
});

describe("resolveDashscopeVideoCreateUrl kling", () => {
  it("uses dashscope shared domain without explicit MAAS baseUrl", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: KLING_V3_VIDEO_MODEL,
      apiKey: "sk-plain-key",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    expect(resolved).toEqual({
      ok: true,
      url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    });
  });
});
