import { describe, expect, it } from "vitest";

import {
  buildPro2FrameMediaPrompt,
  buildPro2PropMediaPrompt,
  buildPro2SceneMediaPrompt,
} from "@/lib/canvas/pro2-lazy-media-prompts";
import {
  isPro2ProductionPackCharacterImagePrompt,
  isPro2ProductionPackFrameImagePrompt,
  isPro2ProductionPackPropImagePrompt,
  isPro2ProductionPackSceneImagePrompt,
  isPro2ProductionPackVideoPrompt,
  finalizePro2CharacterImageDockPrompt,
  finalizePro2SceneImageDockPrompt,
  finalizePro2PropImageDockPrompt,
  buildPro2CharacterVisualStyleTag,
} from "@/lib/canvas/pro2-production-pack-prompt";
import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
} from "@/lib/canvas/data/pro2-production-pack-standard";

const CHARACTER = `名称：现代沈昭昭，现代职场女性

描述：现代职场社畜，女，28岁

服装：浅灰色条纹衬衫

特征：眼下有明显的黑眼圈

构图规范：高质量专业角色设定图；布局结构（必须是角色四视图）：正面面部头部特写 + 全身正/侧/背。

[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]`;

const SCENE = `名称：金銮殿，皇家大殿。

描述：室内，宏观，高度约15米。

前背景：红漆盘龙柱、汉白玉地面。

氛围：威严压抑。

构图规范：高质量专业场景设定图，以 2 行 2 列的干净网格四等分整齐排版，展示同一场景的四个大全景视角。

[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]`;

const PROP = `名称：电脑，现代办公电脑显示器。

描述：16:9宽屏液晶显示器。

特征：现代标准尺寸办公屏幕。

构图规范：高质量写实道具多角度展示图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。

[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]`;

const FRAME_IMAGE =
  "特写景别。深夜昏暗的现代办公室场景。她正伏案加班。[视觉风格：穿越题材，国风二次元厚涂，2D动漫媒介]";

const VIDEO = `出场角色：
沈昭昭，女，身高1.65米

---

背景场景：
现代办公室

---

参考图使用规则：
角色参考图：只参考此图中的角色形象

---

当前分镜的分段描述：
0-3 秒：画面：特写景别

---

输出约束：
1. 角色一致性`;

describe("pro2-production-pack-prompt", () => {
  it("detects golden examples from docs/画布提示词.md", () => {
    expect(isPro2ProductionPackCharacterImagePrompt(CHARACTER)).toBe(true);
    expect(isPro2ProductionPackSceneImagePrompt(SCENE)).toBe(true);
    expect(isPro2ProductionPackPropImagePrompt(PROP)).toBe(true);
    expect(isPro2ProductionPackFrameImagePrompt(FRAME_IMAGE)).toBe(true);
    expect(isPro2ProductionPackVideoPrompt(VIDEO)).toBe(true);
  });

  it("passes through scene imagePrompt with canonical four-view composition", () => {
    const prompt = buildPro2SceneMediaPrompt(
      {
        key: "scene-1",
        name: "金銮殿",
        description: "",
        imageKeywords: SCENE,
        prompt: "",
      },
      null,
    );
    expect(prompt).toContain(`构图规范：${PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).not.toContain("SCENE REFERENCE");
    expect(prompt).not.toContain("【场景空镜约束】");
  });

  it("replaces truncated scene composition spec with canonical text", () => {
    const prompt = finalizePro2SceneImageDockPrompt(SCENE);
    expect(prompt).toContain(`构图规范：${PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain("左前方45度");
    expect(prompt).not.toContain("展示同一场景的四个大全景视角。\n");
  });

  it("passes through prop imagePrompt with canonical six-view composition", () => {
    const prompt = buildPro2PropMediaPrompt({
      key: "prop-1",
      name: "电脑",
      description: PROP,
      prompt: PROP,
    });
    expect(prompt).toContain(`构图规范：${PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain("绝对正上方俯拍视图");
  });

  it("replaces truncated prop composition spec with canonical text", () => {
    const prompt = finalizePro2PropImageDockPrompt(PROP);
    expect(prompt).toContain(`构图规范：${PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain("移轴镜头");
  });

  it("passes through frameImagePrompt without 景别 prefix", () => {
    const prompt = buildPro2FrameMediaPrompt({
      frameIndex: 1,
      key: "1",
      scene: "办公室",
      description: "伏案",
      dialogue: "—",
      videoPrompt: "",
      frameImagePrompt: FRAME_IMAGE,
      prompt: FRAME_IMAGE,
    });
    expect(prompt).toBe(FRAME_IMAGE);
    expect(prompt).not.toMatch(/^景别：/);
  });

  it("replaces truncated composition spec with canonical four-view text", () => {
    const truncated = CHARACTER;
    const prompt = finalizePro2CharacterImageDockPrompt(truncated);
    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).not.toContain("全身正/侧/背");
  });

  it("appends composition spec and visual style tag when LLM omits them", () => {
    const partial = `名称：现代沈昭昭，现代职场女性

描述：女，28岁，身高1.65米

服装：浅灰色条纹衬衫

特征：眼下有明显的黑眼圈，双颊微陷`;

    const prompt = finalizePro2CharacterImageDockPrompt(partial, {
      visualStylePack: {
        era: "盛唐穿越题材",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    });

    expect(prompt).toContain("特征：眼下有明显的黑眼圈");
    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain(
      "[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]",
    );
  });

  it("appends visual style tag from hub pack when LLM omits it", () => {
    const partial = `名称：现代沈昭昭，现代职场女性

描述：女，28岁，身高1.65米

服装：浅灰色条纹衬衫

特征：眼下有明显的黑眼圈，双颊微陷`;

    const prompt = finalizePro2CharacterImageDockPrompt(partial, {
      visualStylePack: {
        era: "盛唐穿越题材",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    });

    expect(prompt).toContain(
      "[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]",
    );
  });

  it("appends visual style tag to scene dock from hub pack", () => {
    const partial = `名称：金銮殿，皇家大殿。

描述：室内，宏观，高度约15米。

前背景：红漆盘龙柱。

氛围：威严压抑。`;
    const prompt = finalizePro2SceneImageDockPrompt(partial, {
      visualStylePack: {
        era: "盛唐穿越题材",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    });
    expect(prompt).toContain(
      "[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]",
    );
  });

  it("appends visual style tag to prop dock from hub pack", () => {
    const partial = `名称：电脑，现代办公电脑显示器。

描述：16:9宽屏液晶显示器。

特征：现代标准尺寸办公屏幕。`;
    const prompt = finalizePro2PropImageDockPrompt(partial, {
      visualStylePack: {
        era: "盛唐穿越题材",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    });
    expect(prompt).toContain(
      "[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]",
    );
  });

  it("buildPro2CharacterVisualStyleTag prefers inline tag", () => {
    expect(
      buildPro2CharacterVisualStyleTag(null, "盛唐穿越题材，国风二次元厚涂"),
    ).toBe("[视觉风格：盛唐穿越题材，国风二次元厚涂]");
  });
});
