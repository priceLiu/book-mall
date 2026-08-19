import { describe, expect, it } from "vitest";
import { buildCrewBulletinFromHub } from "@/lib/canvas/crew-bulletin-build";
import { tryRepairHubFromStoredProductionJson } from "@/lib/canvas/pro2-production-script-apply";
import {
  resolvePro2HubCharacterPickerRows,
  resolvePro2HubStoryboardPickerRows,
} from "@/lib/canvas/pro2-script-hub-helpers";
import { applyHubSectionFromTask } from "@/lib/canvas/story-row-patch";
import {
  buildSceneRowsFromProductionScript,
  splitEnvironmentTimeMood,
} from "@/lib/canvas/story-column-sync";
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

    const pickerRows = resolvePro2HubCharacterPickerRows(merged);
    expect(pickerRows[0]?.name).toBe("沈知意");
    expect(pickerRows[0]?.personality).toContain("乖巧");
  });

  it("scene picker rows split environmentTimeMood from JSON", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
      productionScript: PRO2_FIXTURE_FULL_PACK.patch,
    };
    const rows = buildSceneRowsFromProductionScript(hub, "hub-1");
    expect(rows[0]?.name).toBe("长安主街·日");
    expect(rows[0]?.environment).toBe("正午暖金阳光");
    expect(rows[0]?.time).toBe("百姓攒动");
    expect(rows[0]?.imageKeywords).toContain("朱雀大街");

    const split = splitEnvironmentTimeMood("深夜 · 压抑 · 电脑蓝光");
    expect(split.environment).toBe("深夜");
    expect(split.time).toBe("压抑");
    expect(split.mood).toBe("电脑蓝光");
  });

  it("storyboard picker rows map productionScript.shots", () => {
    const hub: StoryProScriptHubNodeData = {
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
      productionScript: PRO2_FIXTURE_FULL_PACK.patch,
    };
    const rows = resolvePro2HubStoryboardPickerRows(hub);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.frameIndex).toBe(1);
    expect(rows[0]?.shotSize).toBe("全景");
    expect(rows[0]?.cameraMove).toBe("缓慢摇移推进，前景旗幡遮挡增加层次");
    expect(rows[0]?.description).toContain("朱雀大街");
    expect(rows[0]?.duration).toBe("10");
    expect(rows[0]?.scene).toBe("长安主街·日");
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

  it("repairs hub when outlineMd is raw JSON blob", () => {
    const rawJson = fixtureWithFence(PRO2_FIXTURE_FULL_PACK);
    const hub: StoryProScriptHubNodeData = {
      outlineMd: rawJson,
      characterMd: "",
      storyboardMd: "",
      providerId: "p",
      modelKey: "m",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
    };
    const patch = tryRepairHubFromStoredProductionJson(hub, "hub-repair");
    expect(patch?.productionScript?.characters?.[0]?.name).toBe("沈知意");
    expect(patch?.outlineMd).toContain("视觉风格总纲");
    expect(patch?.outlineMd).not.toContain('"schemaVersion"');
  });
});
