import { describe, expect, it } from "vitest";
import {
  buildWizardShotFrameRunPayload,
  buildWizardShotVideoRunPayload,
  isWizardShotTaskStaleInflight,
  parseWizardShotRunnerNodeId,
  pickWizardShotInflightTask,
  pickWizardShotTaskPreviewUrl,
  resolveWizardShotVideoModelKey,
  wizardShotRunnerNodeId,
  WIZARD_SHOT_STALE_INFLIGHT_MS,
  type WizardShotTaskRecord,
} from "@/lib/canvas/pro2-wizard-shot-media-run";
import { listMissingWizardAssetMentions } from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";

function inflightTask(
  overrides: Partial<WizardShotTaskRecord> = {},
): WizardShotTaskRecord {
  const ago = new Date(Date.now() - WIZARD_SHOT_STALE_INFLIGHT_MS - 1000).toISOString();
  return {
    id: "task-1",
    nodeId: "node-1",
    kind: "IMAGE",
    status: "PENDING",
    model: "test-model",
    ossUrl: null,
    ephemeralUrl: null,
    textOutput: null,
    failCode: null,
    failMessage: null,
    submittedAt: null,
    completedAt: null,
    kieTaskId: null,
    createdAt: ago,
    updatedAt: ago,
    ...overrides,
  };
}

const frameSettings: Sbv1ImageNodeData = {
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

const assetDrafts = {
  "character:c1": {
    kind: "character" as const,
    assetId: "c1",
    previewUrl: "https://cdn.example/char.png",
  },
  "scene:s1": {
    kind: "scene" as const,
    assetId: "s1",
    previewUrl: "https://cdn.example/scene.png",
  },
};

describe("parseWizardShotRunnerNodeId", () => {
  it("round-trips wizard virtual node ids", () => {
    const hubId = "hub1";
    expect(
      parseWizardShotRunnerNodeId(wizardShotRunnerNodeId(hubId, "video", 1)),
    ).toEqual({
      scriptHubId: hubId,
      mediaKind: "video",
      shotIndex: 1,
    });
  });
});

describe("pickWizardShotInflightTask", () => {
  it("prefers bound inflight task id", () => {
    const nodeId = wizardShotRunnerNodeId("hub1", "video", 1);
    const task = pickWizardShotInflightTask(
      [
        {
          ...inflightTask(),
          id: "task-a",
          nodeId,
          status: "SUBMITTED",
        },
      ],
      nodeId,
      "task-a",
    );
    expect(task?.id).toBe("task-a");
  });
});

describe("pickWizardShotTaskPreviewUrl", () => {
  it("uses list API previewUrl when ossUrl is empty", () => {
    const url = pickWizardShotTaskPreviewUrl({
      id: "t1",
      nodeId: "n1",
      kind: "IMAGE",
      status: "SUCCEEDED",
      model: "kling-3.0/video",
      ossUrl: null,
      ephemeralUrl: null,
      textOutput: null,
      failCode: null,
      failMessage: null,
      submittedAt: null,
      completedAt: null,
      kieTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      previewUrl: "https://cdn.example/clip.mp4",
      previewKind: "video",
    });
    expect(url).toBe("https://cdn.example/clip.mp4");
  });
});

describe("isWizardShotTaskStaleInflight", () => {
  it("flags old PENDING tasks without vendor progress as stale", () => {
    expect(isWizardShotTaskStaleInflight(inflightTask())).toBe(true);
  });

  it("does not flag recent PENDING tasks", () => {
    const recent = new Date().toISOString();
    expect(
      isWizardShotTaskStaleInflight(
        inflightTask({ createdAt: recent, updatedAt: recent }),
      ),
    ).toBe(false);
  });

  it("does not flag inflight tasks with kieTaskId", () => {
    expect(
      isWizardShotTaskStaleInflight(
        inflightTask({ kieTaskId: "vendor-task-123" }),
      ),
    ).toBe(false);
  });

  it("does not flag terminal tasks", () => {
    expect(
      isWizardShotTaskStaleInflight(
        inflightTask({ status: "SUCCEEDED", completedAt: new Date().toISOString() }),
      ),
    ).toBe(false);
  });
});

describe("listMissingWizardAssetMentions", () => {
  it("lists wiz asset mentions without previewUrl", () => {
    const script = {
      schemaVersion: 2,
      characters: [{ id: "c1", name: "沈昭昭" }],
      scenes: [{ id: "s1", name: "办公室" }],
      shots: [],
    } as import("@/lib/canvas/data/pro2-production-script-schema").Pro2ProductionScript;

    const missing = listMissingWizardAssetMentions(
      "特写 @<wiz-char-c1> 在 @<wiz-scene-s1>",
      script,
      {
        "scene:s1": {
          kind: "scene",
          assetId: "s1",
          previewUrl: "https://cdn.example/scene.png",
        },
      },
    );

    expect(missing).toHaveLength(1);
    expect(missing[0]?.label).toBe("角色 · 沈昭昭");
  });
});

describe("buildWizardShotFrameRunPayload", () => {
  it("passes mentioned asset preview URLs as imageInputs", () => {
    const payload = buildWizardShotFrameRunPayload(
      frameSettings,
      "特写 @<wiz-char-c1> 在 @<wiz-scene-s1>",
      [],
      undefined,
      assetDrafts,
    );
    expect(payload.imageInputs).toEqual([
      "https://cdn.example/char.png",
      "https://cdn.example/scene.png",
    ]);
  });

  it("does not pass all page assets when prompt has no @ mentions", () => {
    const payload = buildWizardShotFrameRunPayload(
      frameSettings,
      "现代深夜办公室，无人物特写",
      [],
      undefined,
      assetDrafts,
    );
    expect(payload.imageInputs).toEqual([]);
  });

  it("passes manual ref zone uploads without @ mentions", () => {
    const payload = buildWizardShotFrameRunPayload(
      frameSettings,
      "办公室场景",
      [{ id: "ref-upload-1", label: "风格", url: "https://cdn.example/style.png" }],
      undefined,
      assetDrafts,
    );
    expect(payload.imageInputs).toEqual(["https://cdn.example/style.png"]);
  });
});

describe("buildWizardShotVideoRunPayload", () => {
  it("merges mentioned assets into row refImages for server resolve", () => {
    const payload = buildWizardShotVideoRunPayload({
      shotIndex: 1,
      prompt: "视频 @<wiz-char-c1>",
      refImages: [],
      framePreviewUrl: "https://cdn.example/frame.png",
      providerId: "kie",
      modelKey: "kling-3.0/video",
      params: {},
      assetDrafts,
    });
    const row = (payload.data.rows as Array<Record<string, unknown>>)[0]!;
    const refs = row.refImages as Array<{ id: string; url?: string }>;
    expect(refs.some((r) => r.id === "wiz-char-c1" && r.url === "https://cdn.example/char.png")).toBe(true);
    expect(payload.imageInputs).toEqual([
      "https://cdn.example/frame.png",
      "https://cdn.example/char.png",
    ]);
  });
});

describe("resolveWizardShotVideoModelKey", () => {
  const frameUrl =
    "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/frame.png";

  it("upgrades HappyHorse T2V → I2V when only frame ref", () => {
    expect(
      resolveWizardShotVideoModelKey({
        modelKey: "happyhorse-1.1-t2v",
        framePreviewUrl: frameUrl,
        prompt: "镜 1 特写",
        refImages: [],
      }),
    ).toBe("happyhorse-1.1-i2v");
  });

  it("upgrades HappyHorse T2V → R2V when frame + @ 资产", () => {
    expect(
      resolveWizardShotVideoModelKey({
        modelKey: "happyhorse-1.1-t2v",
        framePreviewUrl: frameUrl,
        prompt: "视频 @<wiz-char-c1>",
        refImages: [],
        assetDrafts: {
          "character:c1": {
            kind: "character",
            assetId: "c1",
            previewUrl: "https://cdn.example/char.png",
          },
        },
      }),
    ).toBe("happyhorse-1.1-r2v");
  });
});
