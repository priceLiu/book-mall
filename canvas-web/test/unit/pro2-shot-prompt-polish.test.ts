import { describe, expect, it } from "vitest";
import { buildShotPromptPolishBundle } from "@/lib/canvas/pro2-shot-prompt-polish";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

const script: Pro2ProductionScript = {
  schemaVersion: 2,
  characters: [
    {
      id: "c1",
      name: "沈昭昭",
      role: "主角",
      appearance: "职场女性",
      personality: "",
      imagePrompt: "中文角色",
    },
  ],
  scenes: [
    {
      id: "s1",
      name: "办公室",
      environmentTimeMood: "深夜",
      imagePrompt: "中文场景",
      negativePrompt: "",
    },
  ],
  shots: [
    {
      index: 1,
      shotSize: "特写",
      lighting: "冷蓝屏幕光",
      cameraMove: "镜头微微前倾，平视略带仰视",
      sceneDescription: "【起始】伏案【结束】抬头",
      dialogue: "—",
      durationSec: 3,
      sfxNote: "键盘声",
      audioNote: "无对白",
      sceneId: "s1",
      characterIds: ["c1"],
    },
    {
      index: 2,
      shotSize: "近景",
      lighting: "暖黄台灯光",
      cameraMove: "缓慢推近至面部特写",
      sceneDescription: "【起始】侧脸【结束】正视镜头",
      dialogue: "好累",
      durationSec: 4,
      sfxNote: "空调低鸣",
      audioNote: "同期对白",
      sceneId: "s1",
      characterIds: ["c1"],
    },
  ],
};

describe("pro2-shot-prompt-polish", () => {
  it("buildShotPromptPolishBundle includes Pass1 and dictionary", () => {
    const bundle = buildShotPromptPolishBundle(2, script, 1);
    expect(bundle).not.toBeNull();
    expect(bundle!.shotIndex).toBe(2);
    expect(bundle!.userPrompt).toContain("镜号：2");
    expect(bundle!.userPrompt).toContain("前一镜");
    expect(bundle!.userPrompt).toContain("沈昭昭");
    expect(bundle!.patchEnvelope.step).toBe("shot_prompts");
  });
});
