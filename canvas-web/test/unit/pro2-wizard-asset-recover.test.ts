import { describe, expect, it } from "vitest";
import {
  pickRecoverableWizardAssetTask,
  wizardAssetDraftNeedsRecovery,
} from "@/lib/canvas/pro2-wizard-asset-recover";
import type { WizardAssetTaskRecord } from "@/lib/canvas/pro2-wizard-asset-image-run";

const NODE = "pro2-wiz-gen-hub-character-c1";

function task(
  partial: Partial<WizardAssetTaskRecord> & Pick<WizardAssetTaskRecord, "id">,
): WizardAssetTaskRecord {
  return {
    nodeId: NODE,
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
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:01:00.000Z",
    ...partial,
  };
}

describe("wizardAssetDraftNeedsRecovery", () => {
  it("recovers missing previewUrl", () => {
    expect(
      wizardAssetDraftNeedsRecovery({
        kind: "character",
        assetId: "c1",
        generateStatus: "idle",
      }),
    ).toBe(true);
  });

  it("recovers expired vendor previewUrl", () => {
    expect(
      wizardAssetDraftNeedsRecovery({
        kind: "scene",
        assetId: "s1",
        previewUrl:
          "https://tempfile.aiquickdraw.com/workers/images/image_dead.png",
        generateStatus: "idle",
      }),
    ).toBe(true);
  });

  it("skips stable OSS previewUrl", () => {
    expect(
      wizardAssetDraftNeedsRecovery({
        kind: "character",
        assetId: "c1",
        previewUrl:
          "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/p/a.png",
        generateStatus: "idle",
      }),
    ).toBe(false);
  });

  it("skips while generateStatus is running", () => {
    expect(
      wizardAssetDraftNeedsRecovery({
        kind: "prop",
        assetId: "p1",
        previewUrl: "https://tempfile.aiquickdraw.com/x.png",
        generateStatus: "running",
      }),
    ).toBe(false);
  });
});

describe("pickRecoverableWizardAssetTask", () => {
  it("prefers bound taskId when settled", () => {
    const tasks = [
      task({
        id: "old",
        ossUrl: "https://cdn.example/old.png",
        completedAt: "2026-08-24T08:00:00.000Z",
      }),
      task({
        id: "bound",
        ossUrl: "https://cdn.example/bound.png",
        completedAt: "2026-08-24T08:05:00.000Z",
      }),
    ];
    const pick = pickRecoverableWizardAssetTask(tasks, "bound", NODE);
    expect(pick?.id).toBe("bound");
  });

  it("falls back to latest succeeded when taskId missing", () => {
    const tasks = [
      task({
        id: "old",
        ossUrl: "https://cdn.example/old.png",
        completedAt: "2026-08-24T08:00:00.000Z",
      }),
      task({
        id: "new",
        ossUrl: "https://cdn.example/new.png",
        completedAt: "2026-08-24T08:10:00.000Z",
      }),
    ];
    const pick = pickRecoverableWizardAssetTask(tasks, undefined, NODE);
    expect(pick?.id).toBe("new");
  });
});
