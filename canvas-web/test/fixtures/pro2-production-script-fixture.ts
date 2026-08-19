import type { Pro2ProductionScriptPatch } from "@/lib/canvas/data/pro2-production-script-schema";

/** 精简 fixture · v2 Pass1 导演表结构 */
export const PRO2_FIXTURE_FULL_PACK: Pro2ProductionScriptPatch = {
  schemaVersion: 2,
  tier: "pro",
  step: "full_pack",
  patch: {
    meta: { title: "测试剧", synopsis: "退婚甜宠" },
    visualStyle: {
      worldBackground: "架空晚唐长安，春季槐花盛开",
      era: "架空晚唐长安城，春季",
      globalColorTone: "暖金色日景 / 冷蓝夜景",
      pictureStyle: "电影级写实",
      cinematography: "35mm 小景深",
      dayPalette: { primary: "#F5D76E", highlight: "#F5B041", shadow: "#8B6914" },
      nightPalette: { primary: "#2C3E50", highlight: "#F39C12" },
      lighting: "自然光侧逆光",
      styleAnchor: "电影级写实古装",
    },
    coreConflict: [
      { dimension: "表层冲突", content: "当众退婚 vs 摄政王" },
      { dimension: "深层冲突", content: "乖巧外表 vs 叛逆内心" },
    ],
    scenes: [
      {
        id: "scene-a",
        name: "长安主街·日",
        environmentTimeMood: "正午暖金阳光，百姓攒动",
        imagePrompt: "电影级古代朱雀大街，青石板路，红灯笼",
        negativePrompt: "动画风、动漫风",
      },
    ],
    characters: [
      {
        id: "char-heroine",
        name: "沈知意",
        role: "富商之女",
        appearance: "鹅蛋脸，杏眼，鹅黄裙装",
        personality: "表面乖巧实则胆大",
        imagePrompt: "18岁女子，鹅黄古装，电影级写实，2K",
      },
    ],
    props: [
      {
        id: "prop-book",
        name: "明黄婚书",
        description: "明黄绢面婚书，边缘金线滚边",
      },
    ],
    shots: [
      {
        index: 1,
        shotSize: "全景",
        lighting: "正午暖金侧逆光，明暗对比强烈",
        cameraMove: "缓慢摇移推进，前景旗幡遮挡增加层次",
        sceneDescription: "【起始】朱雀大街人声鼎沸。【结束】女主举婚书立于外廊。",
        propIds: ["prop-book"],
        dialogue: "百姓甲：「她要退婚？」",
        durationSec: 10,
        sfxNote: "人群议论声、旗幡猎猎",
        audioNote: "群杂收音",
        sceneId: "scene-a",
        characterIds: ["char-heroine"],
      },
      {
        index: 2,
        shotSize: "中景",
        lighting: "暖金侧光打亮人物轮廓",
        cameraMove: "固定机位平拍，缓慢推近，人物入画",
        sceneDescription: "【起始】承接上镜举书姿势。【结束】男主现身楼下。",
        dialogue: "—",
        durationSec: 8,
        sfxNote: "远处马蹄声",
        audioNote: "男主台词同期",
      },
    ],
    handoff: [
      { index: 1, item: "角色三视图", owner: "美术", note: "按角色表生成" },
      { index: 2, item: "场景图", owner: "美术", note: "按场景辞典" },
      { index: 3, item: "分镜提示词润色", owner: "导演", note: "Pass2 生成 frameImagePrompt + videoPrompt" },
      { index: 4, item: "配音", owner: "声音", note: "对白轨" },
      { index: 5, item: "BGM", owner: "声音", note: "古风暧昧" },
      { index: 6, item: "粗剪交付", owner: "剪辑", note: "180秒" },
    ],
  },
};

export function fixtureWithFence(patch: Pro2ProductionScriptPatch): string {
  return [
    "## 视觉风格总纲",
    "",
    "（人读 Markdown 可选）",
    "",
    "```pro2-production-script",
    JSON.stringify(patch, null, 2),
    "```",
  ].join("\n");
}
