import { describe, expect, it } from "vitest";
import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_HANDOFF_TABLE_HEADER,
  STORY_PRO2_PACK_V7_MARKER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
} from "@/lib/canvas/data/pro2-production-pack-standard";

/** 金标准表头 · docs/result.md */
const RESULT_MD_HEADERS = {
  scene:
    "| 场景名 | 环境/时间/气氛 | 生图关键词(英文) | 固定反向提示词 |",
  character:
    "| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |",
  storyboard:
    "| 镜号 | 景别 | 光影 | 运镜 | 画面描述（含起始→终止站位） | 道具 | 对白 | 时长(秒) | 音效 | 口型/配音备注 |",
  handoff: "| 序号 | 交接项 | 负责方 | 备注 |",
};

function headerCols(headerBlock: string): string[] {
  const line = headerBlock.split("\n")[0] ?? "";
  return line.split("|").map((c) => c.trim()).filter(Boolean);
}

describe("pro2 pack schema v7 · result.md alignment", () => {
  it("canonical scene table is 4 columns", () => {
    expect(headerCols(STORY_PRO2_SCENE_TABLE_HEADER)).toEqual(
      headerCols(RESULT_MD_HEADERS.scene),
    );
  });

  it("canonical character table is 5 columns", () => {
    expect(headerCols(STORY_PRO2_CHARACTER_TABLE_HEADER)).toEqual(
      headerCols(RESULT_MD_HEADERS.character),
    );
  });

  it("canonical storyboard table is 10 columns v2 Pass1 director table", () => {
    expect(headerCols(STORY_PRO2_STORYBOARD_TABLE_HEADER)).toEqual(
      headerCols(RESULT_MD_HEADERS.storyboard),
    );
  });

  it("handoff table is 4 columns", () => {
    expect(headerCols(STORY_PRO2_HANDOFF_TABLE_HEADER)).toEqual(
      headerCols(RESULT_MD_HEADERS.handoff),
    );
    expect(STORY_PRO2_PACK_V7_MARKER).toBe("序号 | 交接项 | 负责方 | 备注");
  });
});
