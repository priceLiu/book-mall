import { describe, expect, it } from "vitest";
import {
  defaultWizardShotPrompt,
  parseWizardShotDraftKey,
  shotRowKey,
  wizardShotDraftKey,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { buildWizardShotMountHubPatch } from "@/lib/canvas/pro2-wizard-shot-mount";
import {
  buildWizardShotFrameRunPayload,
  buildWizardShotVideoRunPayload,
  wizardShotRunnerNodeId,
} from "@/lib/canvas/pro2-wizard-shot-media-run";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

describe("wizardShotDraftKey", () => {
  it("round-trips frame and video keys", () => {
    expect(wizardShotDraftKey("frame", 3)).toBe("frame:3");
    expect(parseWizardShotDraftKey("video:12")).toEqual({
      mediaKind: "video",
      shotIndex: 12,
    });
    expect(parseWizardShotDraftKey("invalid")).toBeNull();
  });

  it("shotRowKey matches frame row key convention", () => {
    expect(shotRowKey(5)).toBe("5");
  });
});

describe("defaultWizardShotPrompt", () => {
  it("prefers Pass2 frameImagePrompt for frame", () => {
    const prompt = defaultWizardShotPrompt("frame", {
      index: 1,
      sceneDescription: "desc",
      frameImagePrompt: "Pass2 frame",
    });
    expect(prompt).toBe("Pass2 frame");
  });

  it("uses videoPrompt for video", () => {
    const prompt = defaultWizardShotPrompt("video", {
      index: 2,
      sceneDescription: "desc",
      videoPrompt: "Seedance 模板",
    });
    expect(prompt).toBe("Seedance 模板");
  });
});

describe("buildWizardShotRunPayload", () => {
  it("builds frame image virtual node payload", () => {
    const payload = buildWizardShotFrameRunPayload(
      {
        engine: { providerId: "p1", modelKey: "m1", params: {} },
        aspectRatio: "16:9",
        imageQuality: "standard",
        resolution: "2K",
        outputCount: 1,
      },
      "test prompt",
      [],
    );
    expect(payload.nodeType).toBe("story-pro2-image");
    expect(payload.data.pro2MediaRole).toBeUndefined();
    expect(payload.data.engine).toBeDefined();
  });

  it("builds video payload with frame gate bypass fields", () => {
    const payload = buildWizardShotVideoRunPayload({
      shotIndex: 1,
      prompt: "video prompt",
      refImages: [],
      framePreviewUrl: "https://example.com/frame.png",
      providerId: "p1",
      modelKey: "v1",
      params: { duration: 5 },
      dialogue: "hello",
    });
    expect(payload.nodeType).toBe("story-pro2-video");
    expect(payload.rowKey).toBe("1");
    expect(payload.data.rows).toMatchObject([
      expect.objectContaining({
        frameImageUrl: "https://example.com/frame.png",
        frameApprovedAt: expect.any(String),
      }),
    ]);
  });

  it("wizardShotRunnerNodeId is stable", () => {
    expect(wizardShotRunnerNodeId("hub1", "frame", 2)).toBe(
      "pro2-wiz-shot-hub1-frame-2",
    );
  });
});

describe("buildWizardShotMountHubPatch", () => {
  it("writes frame preview to hub rows", () => {
    const hubData = {
      productionScript: {
        schemaVersion: 1,
        shots: [{ index: 1, sceneDescription: "a" }],
      },
      scriptStudioFrameRows: [
        {
          frameIndex: 1,
          key: "1",
          scene: "",
          description: "",
          dialogue: "",
          videoPrompt: "",
          prompt: "old",
        },
      ],
      scriptStudioVideoRows: [{ frameIndex: 1, key: "1", dialogue: "" }],
    } as unknown as StoryProScriptHubNodeData;

    const patch = buildWizardShotMountHubPatch(
      hubData,
      "hub1",
      "frame",
      1,
      "https://cdn/frame.png",
      "task-1",
      "new prompt",
    );
    expect(patch?.scriptStudioFrameRows?.[0]?.runtime?.ossUrl).toBe(
      "https://cdn/frame.png",
    );
    expect(patch?.scriptStudioFrameRows?.[0]?.prompt).toBe("new prompt");
    expect(patch?.scriptStudioVideoRows?.[0]?.frameImageUrl).toBe(
      "https://cdn/frame.png",
    );
  });
});
