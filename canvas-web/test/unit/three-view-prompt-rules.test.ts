import { describe, expect, it } from "vitest";
import {
  buildPro2ThreeViewDockPrompt,
  buildThreeViewCharacterBody,
  isPro2ProductionPackCharacterImagePrompt,
  normalizeThreeViewDockPrompt,
  resolveCharacterRowThreeViewPrompt,
} from "@/lib/canvas/three-view-prompt-rules";
import { PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC } from "@/lib/canvas/data/pro2-production-pack-standard";

const PRODUCTION_PACK_CHARACTER_PROMPT = `名称：现代沈昭昭，现代职场女性

描述：现代职场社畜，女，28岁，身高1.65米，体型偏瘦，中长发，发质干枯，黑色头发，瓜子脸，黑瞳，肤色苍白

服装：上衣为宽松的浅灰色条纹衬衫，下装为黑色西装长裤，黑色平底皮鞋，无帽，无配饰

特征：眼下有明显的黑眼圈，双颊微陷

构图规范：高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构（必须是角色四视图）：正面面部头部特写（占图片水平 1/3 的空间）+ [全身正面视图 + 全身左侧面视图 + 全身背面视图]（占图片水平剩余的 2/3 的空间，并列排列），四个视图中间用淡灰色(#E2E2E2)的2px细线分割，无任何道具或背景物体。

[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]`;

const XIAO_JINGHENG_APPEARANCE = `- 年龄与身份：24 岁，中国古代王爷，架空唐代风格。
- 发型：乌黑长发，佩戴银色尖刺造型的玄幻冠饰。
- 面容：眉眼深邃冷冽，瓷白冷调肤质，哑光质感。表情中立。
- 服饰：深墨蓝暗青色广袖长袍，绣有银龙暗纹刺绣（正面、侧面、背面的龙纹位置可略有不同，以符合服装裁剪逻辑）。
- 肩甲：金属镂空肩甲，呈现真实金属质感与反光。
- 整体材质：长袍呈现丝绸自然垂坠感，肩甲呈现金属光泽，皮肤呈现真实哑光质感。`;

const SAMPLE_APPEARANCE_ZH =
  "黑色发丝，高耸云鬓，点缀精致珍珠步摇；内穿白色广袖，外罩鹅黄色绣绸夹与飘逸薄纱长裙。";

const VISUAL_PACK = {
  era: "架空唐代，长安城",
  visualStyle: "照片级写实，电影感真人拍摄风格",
  colorPalette: "肤色与织物高光呈现暖金色，金属与阴影区域呈现冷蓝灰色",
  lighting:
    "自然日光感，主光源来自右后方的侧逆光，辅光来自左前方柔和补光，以清晰呈现面部细节。拒绝平光。",
  worldBackground: "唐代美学，春夏之交的温暖感",
};

describe("three-view-prompt-rules", () => {
  it("detects production pack character imagePrompt", () => {
    expect(isPro2ProductionPackCharacterImagePrompt(PRODUCTION_PACK_CHARACTER_PROMPT)).toBe(
      true,
    );
  });

  it("passes through LLM production pack imagePrompt with canonical four-view composition", () => {
    const prompt = buildPro2ThreeViewDockPrompt(
      {
        name: "现代沈昭昭",
        role: "现代职场社畜",
        appearance: "女，28岁，浅灰条纹衬衫",
        aiImagePrompt: PRODUCTION_PACK_CHARACTER_PROMPT,
      },
      VISUAL_PACK,
    );

    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain("名称：现代沈昭昭");
    expect(prompt).not.toContain("【任务】");
    expect(prompt).not.toContain("【全局视觉风格");
  });

  it("prefers aiImagePrompt over stale legacy row.prompt", () => {
    const legacyPrompt = `【任务】
生成主角的标准三视图设计稿。`;

    const prompt = buildPro2ThreeViewDockPrompt(
      {
        name: "现代沈昭昭",
        role: "现代职场社畜",
        appearance: "女，28岁，浅灰条纹衬衫",
        aiImagePrompt: PRODUCTION_PACK_CHARACTER_PROMPT,
        prompt: legacyPrompt,
      },
      VISUAL_PACK,
    );

    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).not.toContain("【任务】");
  });

  it("appends missing composition spec and visual style for partial imagePrompt", () => {
    const partial = `名称：现代沈昭昭，现代职场女性

描述：女，28岁，身高1.65米，偏瘦

服装：浅灰色条纹衬衫

特征：眼下有明显的黑眼圈，双颊微陷`;

    const prompt = buildPro2ThreeViewDockPrompt(
      {
        name: "现代沈昭昭",
        role: "现代职场社畜",
        appearance: "…",
        aiImagePrompt: partial,
      },
      {
        era: "盛唐穿越题材",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    );

    expect(prompt).toContain("构图规范：");
    expect(prompt).toContain("角色四视图");
    expect(prompt).toContain("[视觉风格：盛唐穿越题材，国风二次元厚涂，2D动漫媒介]");
    expect(prompt).not.toContain("【任务】");
  });

  it("builds golden four-view prompt for legacy appearance rows", () => {
    const prompt = buildPro2ThreeViewDockPrompt(
      {
        name: "萧景珩",
        role: "摄政王",
        appearance: XIAO_JINGHENG_APPEARANCE,
        personality: "清冷矜贵",
      },
      VISUAL_PACK,
    );

    expect(prompt).toContain("名称：萧景珩，摄政王");
    expect(prompt).toContain("描述：");
    expect(prompt).toContain("服装：");
    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).toContain("[视觉风格：");
    expect(prompt).not.toContain("【任务】");
    expect(prompt).not.toContain("【全局视觉风格");
    expect(prompt).not.toContain("White-bg turnaround");
    expect(prompt).not.toContain("性格：");
  });

  it("builds character section as bullet block under header", () => {
    const body = buildThreeViewCharacterBody({
      name: "沈知意",
      role: "京城第一富商之女",
      appearance: SAMPLE_APPEARANCE_ZH,
      personality: "表面端庄，内心倔强",
    });
    expect(body).toContain("【角色设定：沈知意 - 京城第一富商之女】");
    expect(body).toContain("- 黑色发丝");
    expect(body).not.toContain("性格：");
  });

  it("resolveCharacterRowThreeViewPrompt omits personality", () => {
    const prompt = resolveCharacterRowThreeViewPrompt({
      name: "沈知意",
      role: "女主",
      appearance: SAMPLE_APPEARANCE_ZH,
      personality: "倔强",
    });
    expect(prompt).toContain("名称：沈知意，女主");
    expect(prompt).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(prompt).not.toContain("性格：");
    expect(prompt).not.toContain("【任务】");
  });

  it("normalizes legacy flat prompt into golden four-view template", () => {
    const legacy = `角色：苏清禾\n定位：女主\n外貌/服装/标志性动作：鹅黄襦裙`;
    const reordered = normalizeThreeViewDockPrompt(legacy, VISUAL_PACK);
    expect(reordered).toContain("名称：苏清禾，女主");
    expect(reordered).toContain(`构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`);
    expect(reordered).not.toContain("【任务】");
  });
});
