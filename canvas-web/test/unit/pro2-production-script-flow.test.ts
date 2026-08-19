import { describe, expect, it } from "vitest";
import { buildCrewBulletinFromHub } from "@/lib/canvas/crew-bulletin-build";
import { applyHubSectionFromTask } from "@/lib/canvas/story-row-patch";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  PRO2_FIXTURE_FULL_PACK,
  fixtureWithFence,
} from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script flow", () => {
  it("applyHubSectionFromTask JSON path → crew bulletin tasks", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
    };

    const text = fixtureWithFence(PRO2_FIXTURE_FULL_PACK);
    const patch = applyHubSectionFromTask(hub, "outline", {
      status: "done",
      taskId: "t1",
    }, text);

    const merged = { ...hub, ...patch } as StoryProScriptHubNodeData;
    expect(merged.productionScript?.characters?.[0]?.name).toBe("沈知意");
    expect(merged.scriptStudioFrameRows?.length).toBe(2);

    const bulletin = buildCrewBulletinFromHub("hub-flow", merged, {
      scriptTitle: "测试剧",
    });

    const kinds = new Set(bulletin.tasks.map((t) => t.kind));
    expect(kinds.has("script")).toBe(true);
    expect(kinds.has("character")).toBe(true);
    expect(kinds.has("scene")).toBe(true);
    expect(kinds.has("frame")).toBe(true);
    expect(kinds.has("frameVideo")).toBe(true);
    expect(
      bulletin.tasks.some((t) => t.kind === "character" && t.label === "沈知意"),
    ).toBe(true);
  });

  it("falls back to MD when no fence present", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
    };
    const mdOnly = `## 角色视觉辞典\n\n| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |\n|------|------|----------------------|------|---------------------|\n| 小明 | 主角 | 圆脸 | 开朗 | 中文生图 prompt |`;

    const patch = applyHubSectionFromTask(hub, "character", {
      status: "done",
    }, mdOnly);

    expect((patch as StoryProScriptHubNodeData).productionScript).toBeUndefined();
    expect(patch.characterMd).toContain("小明");
  });
});
