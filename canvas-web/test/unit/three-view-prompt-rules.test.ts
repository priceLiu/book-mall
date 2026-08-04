import { describe, expect, it } from "vitest";
import {
  buildPro2ThreeViewDockPrompt,
  buildThreeViewCharacterBody,
  normalizeThreeViewDockPrompt,
  resolveCharacterRowThreeViewPrompt,
  THREE_VIEW_HARD_CONSTRAINTS_ZH,
  THREE_VIEW_TASK_ZH,
  THREE_VIEW_TURNAROUND_REQUIREMENT_EN,
} from "@/lib/canvas/three-view-prompt-rules";

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
  it("assembles task → constraints → character → global visual → en", () => {
    const prompt = buildPro2ThreeViewDockPrompt(
      {
        name: "萧景珩",
        role: "摄政王",
        appearance: XIAO_JINGHENG_APPEARANCE,
        personality: "清冷矜贵",
      },
      VISUAL_PACK,
    );

    expect(prompt.indexOf(THREE_VIEW_TASK_ZH)).toBeLessThan(
      prompt.indexOf("【角色设定：萧景珩 - 摄政王】"),
    );
    expect(prompt.indexOf("【角色设定：萧景珩 - 摄政王】")).toBeLessThan(
      prompt.indexOf("【全局视觉风格"),
    );
    expect(prompt.indexOf("【全局视觉风格")).toBeLessThan(
      prompt.indexOf(THREE_VIEW_TURNAROUND_REQUIREMENT_EN),
    );

    expect(prompt).toContain(THREE_VIEW_HARD_CONSTRAINTS_ZH);
    expect(prompt).toContain(XIAO_JINGHENG_APPEARANCE);
    expect(prompt).toContain("照片级写实");
    expect(prompt).toContain("环境光适配");
    expect(prompt).not.toContain("性格：");
    expect(prompt).not.toContain("【三视图 · 系统约束】");
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
    expect(prompt).toContain("【任务】");
    expect(prompt).not.toContain("性格：");
  });

  it("normalizes legacy flat prompt into new template", () => {
    const legacy = `角色：苏清禾\n定位：女主\n外貌/服装/标志性动作：鹅黄襦裙`;
    const reordered = normalizeThreeViewDockPrompt(legacy, VISUAL_PACK);
    expect(reordered.indexOf("【角色设定：苏清禾 - 女主】")).toBeGreaterThan(-1);
    expect(reordered.indexOf("【任务】")).toBeLessThan(
      reordered.indexOf("【角色设定"),
    );
    expect(reordered).toContain("【全局视觉风格");
    expect(reordered.match(/【任务】/g)?.length).toBe(1);
  });
});
