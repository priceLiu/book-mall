import { describe, expect, it } from "vitest";

import type { FashionDeliverable } from "@/lib/fashion-types";
import {
  FASHION_CONFIRM_STORYBOARD,
  FASHION_OUTPUT_SCRIPT,
  FASHION_REGENERATE_OPS,
  fashionMetaAfterLlmFailure,
  inferFashionChoices,
  isAwaitingFashionStoryboardConfirm,
  isFashionInProduce,
  isFashionPendingOpsGeneration,
  resolveFashionDeliverable,
} from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function fashionProject(
  deliverable: Partial<FashionDeliverable>,
  chatHistory: StoryboardProject["chatHistory"] = [],
): StoryboardProject {
  const base: FashionDeliverable = {
    schemaVersion: "fashion-v4",
    vertical: "fashion_apparel",
    productName: "测试款",
    dimensions: {},
    sellpoints: [{ id: "SP01", level: "core", text: "抗皱" }],
    sellpointsLocked: true,
    voiceovers: [{ id: "V01", type: "情绪", narrative: "口播" }],
    selectedVoiceoverId: "V01",
    storyboardVersions: {
      C: {
        id: "C",
        title: "情绪氛围式",
        panels: [{ shotNo: 1, shotType: "中全景", durationSec: 5, cameraMove: "慢摇上" }],
      },
    },
    selectedVersion: "C",
    storyboardLocked: false,
    coverageChecklist: [],
    outputMode: null,
    ...deliverable,
  };
  return {
    id: "proj-1",
    references: [{ role: "product", url: "https://example.com/p.jpg" }],
    chatHistory,
    meta: {
      deliverable: base,
      workflow: { vertical: "fashion_apparel", fashionPhase: "storyboard_confirm" },
    },
  } as StoryboardProject;
}

describe("fashion storyboard confirm → ops loop", () => {
  it("infers storyboardLocked from chat confirm when meta lost lock", () => {
    const project = fashionProject(
      { storyboardLocked: false },
      [{ id: "u1", role: "user", content: FASHION_CONFIRM_STORYBOARD, createdAt: "" }],
    );
    const d = resolveFashionDeliverable(project);
    expect(d?.storyboardLocked).toBe(true);
    expect(isAwaitingFashionStoryboardConfirm(project)).toBe(false);
    expect(isFashionPendingOpsGeneration(project)).toBe(true);
  });

  it("shows retry ops instead of confirm after user already confirmed", () => {
    const project = fashionProject(
      { storyboardLocked: false },
      [{ id: "u1", role: "user", content: FASHION_CONFIRM_STORYBOARD, createdAt: "" }],
    );
    const choices = inferFashionChoices(project);
    expect(choices).toHaveLength(1);
    expect(choices[0]?.message).toBe(FASHION_REGENERATE_OPS);
  });

  it("ops LLM failure rollback keeps storyboardLocked", () => {
    const prevDeliverable = fashionProject({ storyboardLocked: false }).meta!.deliverable;
    const patchedDeliverable = {
      ...(prevDeliverable as FashionDeliverable),
      storyboardLocked: true,
    };
    const rollback = fashionMetaAfterLlmFailure(
      "fashion-step:ops-generate",
      { deliverable: prevDeliverable, workflow: { fashionPhase: "storyboard_confirm" } },
      { deliverable: patchedDeliverable },
    );
    expect((rollback.deliverable as FashionDeliverable).storyboardLocked).toBe(true);
  });

  it("version A pick ignores stale locked/outputMode and shows confirm step", () => {
    const project = fashionProject(
      {
        selectedVersion: "A",
        storyboardLocked: true,
        outputMode: "script_compose",
        opsPack: { titles: ["旧标题"] },
        storyboardVersions: {
          A: {
            id: "A",
            title: "快节奏种草",
            panels: [{ shotNo: 1, shotType: "中全景", durationSec: 5, cameraMove: "慢摇上" }],
          },
        },
      },
      [{ id: "u1", role: "user", content: "选择分镜 A版：快节奏种草", createdAt: "" }],
    );
    const d = resolveFashionDeliverable(project);
    expect(d?.storyboardLocked).toBe(false);
    expect(d?.outputMode).toBeNull();
    expect(d?.opsPack).toBeUndefined();
    expect(isFashionInProduce(project)).toBe(false);
    expect(isAwaitingFashionStoryboardConfirm(project)).toBe(true);
    const choices = inferFashionChoices(project);
    expect(choices.some((c) => c.message === FASHION_CONFIRM_STORYBOARD)).toBe(true);
    expect(choices.some((c) => c.message === FASHION_OUTPUT_SCRIPT)).toBe(false);
  });
});
