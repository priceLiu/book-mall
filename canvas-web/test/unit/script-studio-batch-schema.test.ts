import { describe, expect, it } from "vitest";

import {
  listScriptStudioBatchIssues,
  scriptStudioBatchSchema,
} from "@/lib/canvas/data/script-studio-batch-schema";

const minimalEpisode = (episodeNo: number) => ({
  episodeNo,
  module1_base: {
    episodeNo,
    standardDuration: "90s",
    coreTheme: "主题",
    prevEpisodeHook: "上集",
    conflictClosure: "冲突",
    cliffhanger: "悬念",
  },
  module2_characters: [
    {
      name: "甲",
      age: "20",
      bodyType: "瘦",
      faceShape: "鹅蛋",
      facialFeatures: "眉清",
      temperament: "稳",
      skin: "白",
      hair: "黑长",
      outfit: "青衫",
      accessories: "玉佩",
      episodeOutfit: "同上",
      emotion: "平静",
      behavior: "克制",
      speechStyle: "文言",
    },
  ],
  module3_scenes: [
    {
      name: "庭院",
      intExt: "外",
      time: "日",
      decor: "石桌",
      lighting: "暖光",
      mood: "静",
      props: "茶具",
      ambientSound: "鸟鸣",
    },
  ],
  module4_props: [],
  module5_outline: "大纲",
  module6_script: "剧本正文",
  module7_storyboard: [
    {
      frameIndex: 1,
      duration: "3s",
      shotSize: "中景",
      cameraMove: "固定",
      description: "开场",
      characterDetail: "甲站立",
      dialogue: "—",
      emotion: "平静",
      bgm: "轻音乐",
    },
  ],
  module8_imagePrompts: [{ frameIndex: 1, zh: "中文提示", en: "English prompt" }],
  module9_videoParams: "16:9 · 24fps",
  module10_editNotes: "剪辑备注",
});

describe("script-studio-batch-schema", () => {
  it("accepts first_round_with_bibles fixture", () => {
    const raw = {
      schemaVersion: 1,
      action: "first_round_with_bibles",
      system: "original",
      batch: { startEpisode: 1, endEpisode: 1, totalEpisodes: 10 },
      frozenBibles: {
        worldview: "世界观",
        characters: "人设",
        scenes: "场景",
        synopsis: "梗概",
      },
      episodes: [minimalEpisode(1)],
    };
    const parsed = scriptStudioBatchSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(listScriptStudioBatchIssues(parsed.data)).toEqual([]);
    }
  });

  it("rejects episode count mismatch", () => {
    const raw = {
      schemaVersion: 1,
      action: "batch_complete",
      system: "original",
      batch: { startEpisode: 1, endEpisode: 2, totalEpisodes: 10 },
      episodes: [minimalEpisode(1)],
    };
    const parsed = scriptStudioBatchSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(listScriptStudioBatchIssues(parsed.data).some((m) => m.includes("episodes"))).toBe(
        true,
      );
    }
  });
});
