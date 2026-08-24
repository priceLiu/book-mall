import { describe, expect, it } from "vitest";
import {
  buildShotPromptPolishBundle,
  extractShotPromptPolishFromText,
  isShotReadyForPromptPolish,
  resolveShotPromptPolishQueuePrompt,
  shotPromptPolishQueueKey,
} from "@/lib/canvas/pro2-shot-prompt-polish";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

const script: Pro2ProductionScript = {
  schemaVersion: 2,
  visualStyle: {
    worldBackground: "现代职场穿越题材",
    era: "当代 + 古代交替",
    pictureStyle: "国风二次元厚涂",
  },
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
  it("buildShotPromptPolishBundle includes Pass1, dictionary and visualStyle", () => {
    const bundle = buildShotPromptPolishBundle(2, script, {
      prevShotIndex: 1,
      outlineMd: "## 故事大纲\n穿越题材",
    });
    expect(bundle).not.toBeNull();
    expect(bundle!.shotIndex).toBe(2);
    expect(bundle!.mode).toBe("both");
    expect(bundle!.userPrompt).toContain("镜号：2");
    expect(bundle!.userPrompt).toContain("前一镜");
    expect(bundle!.userPrompt).toContain("沈昭昭");
    expect(bundle!.userPrompt).toContain("视觉风格总纲");
    expect(bundle!.userPrompt).toContain("现代职场穿越题材");
    expect(bundle!.userPrompt).toContain("故事大纲摘要");
    expect(bundle!.patchEnvelope.step).toBe("shot_prompts");
  });

  it("frame-only mode adjusts system prompt", () => {
    const bundle = buildShotPromptPolishBundle(1, script, { mode: "frame" });
    expect(bundle!.mode).toBe("frame");
    expect(bundle!.systemPrompt).toContain("frameImagePrompt");
    expect(bundle!.systemPrompt).not.toContain("videoPrompt\": \"<中文多段");
    expect(bundle!.userPrompt).toContain("frameImagePrompt");
  });

  it("extractShotPromptPolishFromText parses fence output", () => {
    const text = `\`\`\`pro2-production-script
{
  "schemaVersion": 2,
  "tier": "pro",
  "step": "shot_prompts",
  "patch": {
    "shots": [
      {
        "index": 1,
        "sceneDescription": "伏案",
        "dialogue": "—",
        "audioNote": "",
        "frameImagePrompt": "特写景别。深夜办公室。",
        "videoPrompt": "出场角色：沈昭昭"
      }
    ]
  }
}
\`\`\``;
    const parsed = extractShotPromptPolishFromText(text, 1, "both");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.frameImagePrompt).toContain("特写");
      expect(parsed.videoPrompt).toContain("沈昭昭");
    }
  });

  it("isShotReadyForPromptPolish allows empty prompts when Pass1 exists", () => {
    expect(
      isShotReadyForPromptPolish({
        index: 1,
        sceneDescription: "伏案加班",
        dialogue: "—",
        audioNote: "",
      }),
    ).toBe(true);
    expect(
      isShotReadyForPromptPolish({
        index: 1,
        sceneDescription: "",
        lighting: "冷蓝光",
        cameraMove: "固定机位缓慢推进",
        dialogue: "—",
        audioNote: "",
      }),
    ).toBe(true);
  });

  it("shotPromptPolishQueueKey scopes frame and video independently", () => {
    expect(shotPromptPolishQueueKey("3", "frame")).toBe("3:frame");
    expect(shotPromptPolishQueueKey("3", "video")).toBe("3:video");
    expect(shotPromptPolishQueueKey("3", "frame")).not.toBe(
      shotPromptPolishQueueKey("3", "video"),
    );
  });

  it("resolveShotPromptPolishQueuePrompt picks the mode-specific queue entry", () => {
    const bundle = buildShotPromptPolishBundle(1, script, { mode: "frame" });
    expect(bundle).not.toBeNull();
    const queues = {
      [shotPromptPolishQueueKey("1", "frame")]: bundle!.userPrompt,
      [shotPromptPolishQueueKey("1", "video")]: "video-only prompt",
    };
    expect(
      resolveShotPromptPolishQueuePrompt(queues, "1", "frame"),
    ).toBe(bundle!.userPrompt);
    expect(
      resolveShotPromptPolishQueuePrompt(queues, "1", "video"),
    ).toBe("video-only prompt");
  });
});
