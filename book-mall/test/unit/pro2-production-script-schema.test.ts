import { describe, expect, it } from "vitest";
import {
  listPro2ShotEntityLinkIssues,
  listShotPromptsPass2Issues,
  pro2ProductionScriptPatchSchema,
} from "@/lib/canvas/data/pro2-production-script-schema";

const MINIMAL_OUTLINE_PATCH = {
  schemaVersion: 1,
  tier: "standard",
  step: "outline",
  patch: {
    visualStyle: {
      worldBackground: "测试背景",
      era: "现代都市",
    },
    coreConflict: [{ dimension: "冲突", content: "内容" }],
    scenes: [
      {
        id: "s1",
        name: "场景A",
        environmentTimeMood: "日内",
        imagePrompt: "空镜",
        negativePrompt: "anime",
      },
    ],
    handoff: [{ index: 1, item: "三视图", owner: "美术", note: "—" }],
  },
};

describe("book-mall pro2-production-script-schema mirror", () => {
  it("parses outline patch at standard tier", () => {
    const result = pro2ProductionScriptPatchSchema.safeParse(MINIMAL_OUTLINE_PATCH);
    expect(result.success).toBe(true);
  });

  it("listPro2ShotEntityLinkIssues flags missing sceneId", () => {
    const issues = listPro2ShotEntityLinkIssues({
      scenes: [{ id: "s1", name: "场景A", environmentTimeMood: "日", imagePrompt: "x" }],
      props: [{ id: "p1", name: "道具A" }],
      characters: [{ id: "c1", name: "角色A", role: "主", appearance: "a" }],
      shots: [
        {
          index: 1,
          shotSize: "特写",
          lighting: "冷光压抑氛围测试用例",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: "【起始】角色A 拿道具A。【结束】保持",
          dialogue: "—",
          durationSec: 10,
          sfxNote: "环境底噪",
          audioNote: "—",
        },
      ],
    });
    expect(issues.some((i) => i.includes("缺少 sceneId"))).toBe(true);
  });

  it("listPro2ShotEntityLinkIssues flags multi-scene same sceneId", () => {
    const issues = listPro2ShotEntityLinkIssues({
      scenes: [
        { id: "s1", name: "现代深夜办公室", environmentTimeMood: "深夜", imagePrompt: "x" },
        { id: "s2", name: "盛唐金銮殿", environmentTimeMood: "白日", imagePrompt: "x" },
      ],
      shots: [
        {
          index: 1,
          shotSize: "特写",
          lighting: "盛唐金銮殿，暖金",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: "【起始】A。【结束】B",
          dialogue: "—",
          durationSec: 10,
          sfxNote: "—",
          audioNote: "—",
          sceneId: "s2",
        },
        {
          index: 2,
          shotSize: "特写",
          lighting: "盛唐金銮殿，暖金",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: "【起始】C。【结束】D",
          dialogue: "—",
          durationSec: 10,
          sfxNote: "—",
          audioNote: "—",
          sceneId: "s2",
        },
      ],
    });
    expect(issues.some((i) => i.includes("禁止全片"))).toBe(true);
  });

  it("listPro2ShotEntityLinkIssues flags multi-scene lighting without canonical name", () => {
    const issues = listPro2ShotEntityLinkIssues({
      scenes: [
        { id: "s1", name: "现代深夜办公室", environmentTimeMood: "深夜", imagePrompt: "x" },
        { id: "s2", name: "盛唐金銮殿", environmentTimeMood: "白日", imagePrompt: "x" },
      ],
      shots: [
        {
          index: 1,
          shotSize: "特写",
          lighting: "盛唐，暖金朱红，白日",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: "【起始】A。【结束】B",
          dialogue: "—",
          durationSec: 10,
          sfxNote: "—",
          audioNote: "—",
          sceneId: "s2",
        },
        {
          index: 2,
          shotSize: "特写",
          lighting: "现代深夜办公室，冷蓝",
          cameraMove: "固定机位缓慢推近主体面部",
          sceneDescription: "【起始】C。【结束】D",
          dialogue: "—",
          durationSec: 10,
          sfxNote: "—",
          audioNote: "—",
          sceneId: "s1",
        },
      ],
    });
    expect(issues.some((i) => i.includes("lighting 须含场景 canonical name"))).toBe(true);
  });

  it("shot_prompts frame mode accepts patch without sceneDescription or videoPrompt", () => {
    const patch = {
      schemaVersion: 2,
      tier: "pro",
      step: "shot_prompts",
      patch: {
        shots: [{ index: 1, frameImagePrompt: "特写，角色在雨夜街头" }],
      },
    };
    const result = pro2ProductionScriptPatchSchema.safeParse(patch);
    expect(result.success).toBe(true);
    expect(listShotPromptsPass2Issues(patch.patch.shots, "frame")).toEqual([]);
  });

  it("shot_prompts frame mode rejects missing frameImagePrompt", () => {
    const issues = listShotPromptsPass2Issues(
      [{ index: 1, videoPrompt: "仅视频" }],
      "frame",
    );
    expect(issues.some((i) => i.includes("frameImagePrompt"))).toBe(true);
  });
});
