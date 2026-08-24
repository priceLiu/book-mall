import { describe, expect, it } from "vitest";
import {
  buildWizardAssetImageRunPayload,
  pickWizardAssetTaskPreviewUrl,
} from "@/lib/canvas/pro2-wizard-asset-image-run";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { CanvasTaskRecord } from "@/lib/canvas-api";

const settings: Sbv1ImageNodeData = {
  engine: {
    providerId: "kie",
    modelKey: "nano-banana-pro",
    params: {},
  },
  aspectRatio: "16:9",
  imageQuality: "standard",
  resolution: "2K",
  outputCount: 1,
};

describe("buildWizardAssetImageRunPayload", () => {
  it("uses story-pro2-three-view for character", () => {
    const payload = buildWizardAssetImageRunPayload(
      "character",
      settings,
      "角色三视图",
      [],
    );
    expect(payload.nodeType).toBe("story-pro2-three-view");
    expect(payload.data.dockInput).toBe("角色三视图");
    expect(payload.data.aspectRatio).toBe("16:9");
  });

  it("coerces nano-banana unsupported aspect to 16:9", () => {
    const payload = buildWizardAssetImageRunPayload(
      "character",
      {
        ...settings,
        engine: { ...settings.engine, modelKey: "nano-banana-pro" },
        aspectRatio: "4:3",
      },
      "角色",
      [],
    );
    expect(payload.data.aspectRatio).toBe("16:9");
  });

  it("sets pro2MediaRole for scene", () => {
    const payload = buildWizardAssetImageRunPayload(
      "scene",
      settings,
      "深夜办公室",
      [{ id: "ref1", label: "ref", url: "https://cdn.example/a.png" }],
    );
    expect(payload.nodeType).toBe("story-pro2-image");
    expect(payload.data.pro2MediaRole).toBe("scene");
    expect(payload.imageInputs).toEqual(["https://cdn.example/a.png"]);
  });

  it("resolves @<wiz-*> mentions to Step1 asset preview URLs", () => {
    const payload = buildWizardAssetImageRunPayload(
      "scene",
      settings,
      "特写 @<wiz-char-c1> 在 @<wiz-scene-s1>",
      [],
      undefined,
      {
        "character:c1": {
          kind: "character",
          assetId: "c1",
          previewUrl: "https://cdn.example/char.png",
        },
        "scene:s1": {
          kind: "scene",
          assetId: "s1",
          previewUrl: "https://cdn.example/scene.png",
        },
      },
    );
    expect(payload.imageInputs).toEqual([
      "https://cdn.example/char.png",
      "https://cdn.example/scene.png",
    ]);
  });

  it("does not pass all generated assets when prompt omits @ mentions", () => {
    const payload = buildWizardAssetImageRunPayload(
      "scene",
      settings,
      "深夜办公室空镜",
      [],
      undefined,
      {
        "character:c1": {
          kind: "character",
          assetId: "c1",
          previewUrl: "https://cdn.example/char.png",
        },
        "scene:s1": {
          kind: "scene",
          assetId: "s1",
          previewUrl: "https://cdn.example/scene.png",
        },
      },
    );
    expect(payload.imageInputs).toEqual([]);
  });

  it("reads previewUrl from enriched task list item", () => {
    const url = pickWizardAssetTaskPreviewUrl({
      id: "t1",
      nodeId: "n1",
      kind: "IMAGE",
      status: "SUCCEEDED",
      model: "nano-banana-pro",
      ossUrl: null,
      ephemeralUrl: null,
      textOutput: null,
      failCode: null,
      failMessage: null,
      submittedAt: null,
      completedAt: null,
      kieTaskId: null,
      createdAt: "",
      updatedAt: "",
      previewUrl: "https://cdn.example/generated.png",
    } satisfies CanvasTaskRecord & { previewUrl: string });
    expect(url).toBe("https://cdn.example/generated.png");
  });
});
