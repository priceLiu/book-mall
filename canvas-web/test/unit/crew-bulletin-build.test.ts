import { describe, expect, it } from "vitest";
import { buildCrewBulletinFromHub } from "@/lib/canvas/crew-bulletin-build";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

describe("buildCrewBulletinFromHub", () => {
  it("builds tasks for script and asset rows", () => {
    const hubData = {
      outlineMd: "# batch",
      scriptStudioTotalEpisodes: 10,
      scriptStudioCharacterRows: [
        {
          key: "char-a",
          name: "张三",
          role: "主角",
          appearance: "…",
          prompt: "",
        },
      ],
      sceneRows: [
        {
          key: "scene-a",
          name: "客厅",
          description: "内景",
          prompt: "",
        },
      ],
      scriptStudioFrameRows: [
        {
          key: "f1",
          frameIndex: 1,
          episodeNo: 1,
          description: "开场",
          dialogue: "",
          prompt: "",
        },
      ],
    } as StoryProScriptHubNodeData;

    const bulletin = buildCrewBulletinFromHub("hub-1", hubData, {
      scriptTitle: "测试剧",
    });

    expect(bulletin.scriptTitle).toBe("测试剧");
    expect(bulletin.tasks.some((t) => t.kind === "script")).toBe(true);
    expect(bulletin.tasks.some((t) => t.kind === "character" && t.label === "张三")).toBe(
      true,
    );
    expect(bulletin.tasks.some((t) => t.kind === "scene" && t.label === "客厅")).toBe(
      true,
    );
    expect(
      bulletin.tasks.some((t) => t.kind === "frame" && t.label.includes("镜1")),
    ).toBe(true);
  });

  it("dedupes scene tasks when stored sceneRows share the same name", () => {
    const hubData = {
      outlineMd: "# 大纲",
      sceneRows: [
        { key: "s1", name: "教室内", description: "内景", prompt: "" },
        { key: "hub-1::教室内", name: "教室内", description: "内景", prompt: "详细" },
      ],
    } as StoryProScriptHubNodeData;

    const bulletin = buildCrewBulletinFromHub("hub-1", hubData);
    const scenes = bulletin.tasks.filter((t) => t.kind === "scene");
    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.label).toBe("教室内");
  });

  it("falls back to characterMd and storyboardMd when scriptStudio rows empty", () => {
    const hubData = {
      outlineMd: "# 大纲",
      characterMd: `| 角色 | 身份 | 外貌 |\n| --- | --- | --- |\n| 小明 | 主角 | 圆脸 |`,
      storyboardMd: `| 镜号 | 场景 | 画面 | 对白 |\n| --- | --- | --- | --- |\n| 1 | 教室 | 小明吃西瓜 | 好甜 |`,
    } as StoryProScriptHubNodeData;

    const bulletin = buildCrewBulletinFromHub("hub-2", hubData);
    expect(bulletin.tasks.some((t) => t.kind === "character")).toBe(true);
    expect(bulletin.tasks.some((t) => t.kind === "frame")).toBe(true);
  });
});
