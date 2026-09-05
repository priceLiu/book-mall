import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  patchProductionWizardAssetDraft,
  wizardAssetDraftsShallowEqual,
} from "@/lib/canvas/pro2-wizard-asset-draft-patch";
import { wizardAssetDraftKey } from "@/lib/canvas/pro2-production-wizard-assets";
import { useCanvasStore } from "@/lib/canvas/store";

const HUB_ID = "hub-1";

function seedHub(
  drafts: Record<string, import("@/lib/canvas/pro2-production-wizard-assets").Pro2ProductionWizardAssetDraft> = {},
) {
  useCanvasStore.setState({
    nodes: [
      {
        id: HUB_ID,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: {
          productionWizardAssetDrafts: drafts,
        },
      },
    ] as ReturnType<typeof useCanvasStore.getState>["nodes"],
  });
}

describe("patchProductionWizardAssetDraft", () => {
  beforeEach(() => {
    seedHub({});
  });

  it("merges from latest store state without clobbering other assets", () => {
    const key1 = wizardAssetDraftKey("character", "c1");
    const key2 = wizardAssetDraftKey("character", "c2");
    seedHub({
      [key1]: {
        kind: "character",
        assetId: "c1",
        generateStatus: "running",
        taskId: "task-1",
      },
      [key2]: {
        kind: "character",
        assetId: "c2",
        prompt: "角色 B",
      },
    });

    patchProductionWizardAssetDraft(HUB_ID, "character", "c2", {
      generateStatus: "running",
      taskId: "task-2",
    });

    const drafts =
      (
        useCanvasStore
          .getState()
          .nodes.find((n) => n.id === HUB_ID)?.data as {
          productionWizardAssetDrafts?: Record<string, unknown>;
        }
      )?.productionWizardAssetDrafts ?? {};

    expect(drafts[key1]).toMatchObject({
      generateStatus: "running",
      taskId: "task-1",
    });
    expect(drafts[key2]).toMatchObject({
      generateStatus: "running",
      taskId: "task-2",
      prompt: "角色 B",
    });
  });

  it("skips noop patches", () => {
    const key = wizardAssetDraftKey("scene", "s1");
    seedHub({
      [key]: {
        kind: "scene",
        assetId: "s1",
        generateStatus: "running",
      },
    });
    const updateNodeData = vi.fn();
    useCanvasStore.setState({ updateNodeData });

    patchProductionWizardAssetDraft(HUB_ID, "scene", "s1", {
      generateStatus: "running",
    });

    expect(updateNodeData).not.toHaveBeenCalled();
  });
});

describe("wizardAssetDraftsShallowEqual", () => {
  it("detects generateStatus changes", () => {
    const key = wizardAssetDraftKey("character", "c1");
    const base = {
      [key]: { kind: "character" as const, assetId: "c1", generateStatus: "idle" as const },
    };
    expect(
      wizardAssetDraftsShallowEqual(base, {
        ...base,
        [key]: { ...base[key], generateStatus: "running" },
      }),
    ).toBe(false);
  });
});
