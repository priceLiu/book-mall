/** 无场景参考图时，用户可选的预设拍摄环境 */

export type ScenePreset = {
  key: string;
  label: string;
  /** 写入助手 user 消息，用于微调分镜画面内容 */
  scriptHint: string;
  /** 写入生图/成片英文提示，约束背景环境 */
  imagePromptHint: string;
};

export const STORYBOARD_SCENE_PRESETS: ScenePreset[] = [
  {
    key: "bedroom",
    label: "卧室",
    scriptHint: "居家卧室环境：衣柜、床铺、梳妆台、柔和室内自然光",
    imagePromptHint:
      "cozy home bedroom interior, wardrobe and soft natural window light",
  },
  {
    key: "living_room",
    label: "客厅",
    scriptHint: "家庭客厅环境：沙发、茶几、电视柜、明亮居家生活感",
    imagePromptHint:
      "modern home living room with sofa, coffee table, bright residential lighting",
  },
  {
    key: "dining_room",
    label: "餐厅",
    scriptHint: "家庭餐厅/餐桌环境：餐桌椅、餐边柜、温馨用餐氛围",
    imagePromptHint:
      "home dining room with dining table and chairs, warm mealtime atmosphere",
  },
  {
    key: "kitchen",
    label: "厨房",
    scriptHint: "家庭厨房环境：灶台、水槽、台面、明亮清洁的厨房光线",
    imagePromptHint:
      "bright home kitchen with counter, sink, clean cooking environment lighting",
  },
  {
    key: "indoor",
    label: "室内",
    scriptHint: "通用室内空间：简洁家居或办公室内，中性明亮光线",
    imagePromptHint:
      "generic bright indoor room, neutral modern interior, soft diffused lighting",
  },
  {
    key: "sports_venue",
    label: "运动场",
    scriptHint: "运动场馆环境：羽毛球馆/健身房/球场，动感体育氛围",
    imagePromptHint:
      "indoor sports court or gymnasium, athletic venue lighting, active atmosphere",
  },
  {
    key: "mall",
    label: "商场",
    scriptHint: "购物中心环境：商铺橱窗、中庭、都市商业氛围",
    imagePromptHint:
      "shopping mall interior, store displays, commercial atrium lighting",
  },
  {
    key: "office",
    label: "办公室",
    scriptHint: "办公职场环境：工位、会议室、都市白领通勤场景",
    imagePromptHint:
      "modern office desk or meeting room, workplace fluorescent lighting",
  },
  {
    key: "outdoor_street",
    label: "户外街头",
    scriptHint: "城市户外街道：人行道、街区、自然日光街景",
    imagePromptHint:
      "urban outdoor street scene, sidewalk, natural daylight city background",
  },
];

export const CUSTOM_SCENE_INPUT_CHOICE = "自定义场景";

export function getScenePresetChoiceLabels(): string[] {
  return STORYBOARD_SCENE_PRESETS.map((p) => p.label);
}

export function resolveScenePresetByLabel(label: string): ScenePreset | null {
  return STORYBOARD_SCENE_PRESETS.find((p) => p.label === label.trim()) ?? null;
}

export function isScenePresetChoice(text: string): boolean {
  return resolveScenePresetByLabel(text) !== null;
}

export function resolveScenePresetByKey(key?: string | null): ScenePreset | null {
  if (!key?.trim()) return null;
  return STORYBOARD_SCENE_PRESETS.find((p) => p.key === key.trim()) ?? null;
}

function sceneAdjustLlmMessage(opts: {
  sceneLabel: string;
  sceneDescription: string;
  productName: string;
  source: "预设" | "自定义";
}): string {
  return [
    `场景参考已确认 | ${opts.source}场景：${opts.sceneLabel} | 产品名：${opts.productName || "（见上文）"}`,
    "",
    `用户未上传场景参考图，已${opts.source === "自定义" ? "填写" : "选择"}拍摄环境。请在不改变镜头数、总时长、口播台词的前提下：`,
    `1. 将三套分镜表格中所有镜头「画面内容」的背景环境统一适配「${opts.sceneLabel}」`,
    "2. storyboard-deliverable 中每个 panel 的 scene/action 须体现该场景的可拍细节",
    "3. 更新 Markdown 分镜表与 storyboard-deliverable JSON 保持一致",
    "",
    `【场景描述】${opts.sceneDescription}`,
    "",
    "【硬性约束】仅调整场景/背景/环境相关描述，勿改动产品名、镜数、时间轴与口播文案。",
  ].join("\n");
}

export function buildScenePresetLlmUserMessage(
  preset: ScenePreset,
  productName: string,
): string {
  return sceneAdjustLlmMessage({
    sceneLabel: preset.label,
    sceneDescription: preset.scriptHint,
    productName,
    source: "预设",
  });
}

export function buildCustomSceneLlmUserMessage(
  description: string,
  productName: string,
): string {
  const text = description.trim().slice(0, 300);
  return sceneAdjustLlmMessage({
    sceneLabel: text,
    sceneDescription: text,
    productName,
    source: "自定义",
  });
}

export function resolveCustomSceneDescription(
  key?: string | null,
  custom?: string | null,
): string | undefined {
  if (key === "custom" && custom?.trim()) return custom.trim();
  return undefined;
}
