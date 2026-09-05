import { describe, expect, it } from "vitest";

import { parseUserSellpointText } from "@/lib/sellpoint-user-input";
import {
  FASHION_AI_SELLPOINTS_CHOICE,
  FASHION_LOCK_SELLPOINTS,
  FASHION_USER_SELLPOINTS_CHOICE,
  fashionWorkflowPatchForChoice,
  resolveProVerticalDeliverable,
} from "@/lib/fashion-workflow";
import type { StoryboardProject } from "@/lib/storyboard-types";

function sellpointsPhaseProject(): StoryboardProject {
  return {
    id: "p1",
    title: "测试",
    chatHistory: [],
    references: [{ role: "product", url: "https://example.com/p.jpg", label: "产品" }],
    sheet: { panels: [], overview: { productHighlight: "", cast: [] }, totalDurationHintSec: 30 },
    meta: {
      workflow: {
        proMode: true,
        vertical: "bags",
        proPhase: "sellpoints",
        dimensionStep: 7,
      },
      deliverable: {
        schemaVersion: "pro-v1",
        vertical: "bags",
        productName: "托特包",
        dimensions: {
          genderCategory: "女包",
          styleCategory: "托特包",
          styleAttribute: "职场办公",
          tier: "中端质感",
          customScene: "通勤",
          platform: "抖音",
          outputLanguage: "中文",
        },
        sellpoints: [],
        sellpointsLocked: false,
        voiceovers: [],
        selectedVoiceoverId: null,
        storyboardVersions: {},
        selectedVersion: null,
        storyboardLocked: false,
        coverageChecklist: [],
        outputMode: null,
      },
    },
  } as StoryboardProject;
}

describe("sellpoint user input", () => {
  it("parses multiline user sellpoints", () => {
    const parsed = parseUserSellpointText("大容量通勤\n头层牛皮\n轻量化");
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.source).toBe("user");
    expect(parsed[0]?.id).toBe("S01");
  });

  it("mode pick offers user vs ai paths", () => {
    const project = sellpointsPhaseProject();
    const userPick = fashionWorkflowPatchForChoice(project, FASHION_USER_SELLPOINTS_CHOICE);
    expect(userPick?.workflow).toMatchObject({ sellpointInputMode: "user" });

    const aiPick = fashionWorkflowPatchForChoice(project, FASHION_AI_SELLPOINTS_CHOICE);
    expect(aiPick?.llmTrigger).toContain("sellpoints-generate");
    expect(aiPick?.workflow).toMatchObject({ sellpointInputMode: "ai" });
  });

  it("user free text creates deliverable without LLM", () => {
    const project = sellpointsPhaseProject();
    const picked = fashionWorkflowPatchForChoice(project, FASHION_USER_SELLPOINTS_CHOICE);
    const withMode = {
      ...project,
      meta: {
        ...project.meta,
        workflow: { ...(project.meta?.workflow ?? {}), ...(picked?.workflow as object) },
      },
    };
    const patch = fashionWorkflowPatchForChoice(withMode, "大容量通勤；头层牛皮");
    expect(patch?.llmTrigger).toBeUndefined();
    expect(patch?.deliverable).toMatchObject({
      sellpoints: [
        expect.objectContaining({ text: "大容量通勤", source: "user" }),
        expect.objectContaining({ text: "头层牛皮", source: "user" }),
      ],
    });
  });

  it("user path shows polish and lock choices after input", () => {
    const project = sellpointsPhaseProject();
    const patch = fashionWorkflowPatchForChoice(project, FASHION_USER_SELLPOINTS_CHOICE);
    const withSellpoints = {
      ...project,
      meta: {
        ...project.meta,
        workflow: {
          ...(project.meta?.workflow ?? {}),
          ...(patch?.workflow as object),
        },
        deliverable: {
          ...(project.meta?.deliverable as object),
          sellpoints: [{ id: "S01", text: "大容量", layer: "core", source: "user" }],
        },
      },
    };
    const lockPatch = fashionWorkflowPatchForChoice(withSellpoints, FASHION_LOCK_SELLPOINTS);
    expect(lockPatch?.llmTrigger).toContain("voiceovers");
  });

  it("locked sellpoints prefer assistant JSON over meta user draft", () => {
    const rawUser = [
      {
        id: "S01",
        text: "精致, 有时装内涵, 设计精细, 轻裸感",
        layer: "core" as const,
        source: "user" as const,
      },
    ];
    const polished = [
      { id: "S01", text: "精致", layer: "core" as const, source: "ai" as const },
      { id: "S02", text: "有时装内涵", layer: "core" as const, source: "ai" as const },
      { id: "S03", text: "设计精细", layer: "core" as const, source: "ai" as const },
    ];
    const assistantJson = JSON.stringify({ sellpoints: polished });
    const project = {
      ...sellpointsPhaseProject(),
      chatHistory: [
        {
          id: "a1",
          role: "assistant",
          content: `\`\`\`json\n${assistantJson}\n\`\`\``,
          createdAt: new Date().toISOString(),
        },
      ],
      meta: {
        ...sellpointsPhaseProject().meta,
        workflow: {
          ...(sellpointsPhaseProject().meta?.workflow ?? {}),
          proSellpointsEdited: true,
        },
        deliverable: {
          ...(sellpointsPhaseProject().meta?.deliverable as object),
          sellpoints: rawUser,
          sellpointsLocked: true,
        },
      },
    } as StoryboardProject;

    const resolved = resolveProVerticalDeliverable(project);
    expect(resolved?.sellpointsLocked).toBe(true);
    expect(resolved?.sellpoints).toHaveLength(3);
    expect(resolved?.sellpoints[0]?.text).toBe("精致");
  });
});
