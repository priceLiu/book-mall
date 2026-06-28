import { describe, expect, it } from "vitest";
import {
  characterCrewTaskDockInput,
  formatCrewTaskDetailText,
  formatCrewTaskTableCells,
  resolveCrewTaskDockInput,
} from "@/lib/canvas/crew-bulletin-task-prompts";
import type { CrewBulletinTask } from "@/lib/canvas/crew-bulletin-types";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";

describe("crew-bulletin-task-prompts", () => {
  const hubData = {
    characterMd: `| 角色 | 身份 | 外貌 |\n| --- | --- | --- |\n| 小明 | 主角 | 圆脸胖乎乎 |`,
  } as StoryProScriptHubNodeData;

  it("builds three-view dock prompt from character markdown", () => {
    const synced = syncStoryProColumnRows(hubData, {}, "hub-1");
    const rowKey = synced.characterRows[0]?.key;
    expect(rowKey).toBeTruthy();

    const task: CrewBulletinTask = {
      id: `character:${rowKey}`,
      kind: "character",
      rowKey: rowKey!,
      label: "小明",
      status: "unclaimed",
    };
    const dock = resolveCrewTaskDockInput(task, "hub-1", hubData);
    expect(dock).toContain("三视图");
    expect(dock).toContain("小明");
    expect(dock).toContain("圆脸胖乎乎");
  });

  it("formats character detail for bulletin list", () => {
    const synced = syncStoryProColumnRows(hubData, {}, "hub-1");
    const rowKey = synced.characterRows[0]?.key;
    const task: CrewBulletinTask = {
      id: "c1",
      kind: "character",
      rowKey: rowKey!,
      label: "小明",
      status: "unclaimed",
    };
    const detail = formatCrewTaskDetailText(task, "hub-1", hubData);
    expect(detail).toContain("定位：主角");
    expect(detail).toContain("外观：圆脸胖乎乎");
  });

  it("uses formatCharacterRowThreeViewPrompt when row prompt empty", () => {
    const prompt = characterCrewTaskDockInput({
      key: "a",
      name: "小红",
      role: "配角",
      appearance: "高瘦",
      prompt: "",
    });
    expect(prompt).toContain("小红");
    expect(prompt).toContain("高瘦");
  });

  it("formats scene detail columns from structured prompt", () => {
    const sceneMd = [
      "| 场景名 | 环境 | 时间 | 气氛 |",
      "| --- | --- | --- | --- |",
      "| 校门外西瓜摊 | 老校门外马路旁 | 中午12:00 | 炎热、嘈杂、生活气 |",
    ].join("\n");
    const hubData = {
      sceneMd,
      sceneRows: [
        {
          key: "orig-hub::校门外西瓜摊",
          name: "校门外西瓜摊",
          description: "",
          prompt: "",
        },
      ],
    } as StoryProScriptHubNodeData;

    const task: CrewBulletinTask = {
      id: "scene:orig-hub::校门外西瓜摊",
      kind: "scene",
      rowKey: "orig-hub::校门外西瓜摊",
      label: "校门外西瓜摊",
      status: "unclaimed",
    };

    const cells = formatCrewTaskTableCells(
      task,
      "__crew_bulletin_meta__",
      hubData,
    );
    expect(cells.名称).toBe("校门外西瓜摊");
    expect(cells.环境).toContain("老校门外");
    expect(cells.时间).toContain("12:00");
    expect(cells.气氛).toContain("炎热");
  });

  it("finds scene row by task label when rowKey hub prefix differs", () => {
    const sceneMd = [
      "| 场景名 | 环境 | 时间 | 气氛 |",
      "| --- | --- | --- | --- |",
      "| 教室内 | 明亮宽敞的小学教室 | 下午上课前 | 嘈杂、期待 |",
    ].join("\n");
    const hubData = { sceneMd } as StoryProScriptHubNodeData;
    const task: CrewBulletinTask = {
      id: "scene:other-hub::教室内",
      kind: "scene",
      rowKey: "other-hub::教室内",
      label: "教室内",
      status: "unclaimed",
    };
    const detail = formatCrewTaskDetailText(
      task,
      "__crew_bulletin_meta__",
      hubData,
    );
    expect(detail).toContain("环境：");
    expect(detail).toContain("教室");
  });
});
