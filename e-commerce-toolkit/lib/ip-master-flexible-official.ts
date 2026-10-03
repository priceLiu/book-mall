/** 与 book-mall/lib/ecom/ecom-ip-master-flexible-official.ts 保持同步（UI SSOT） */
export const IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES = [
  "色彩方案",
  "具体形象",
  "五官细节",
  "配饰与服装",
  "2D 表情包适配",
  "品牌 VI 延展",
] as const;

export type IpMasterOfficialFlexibleFeatureName =
  (typeof IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES)[number];

export type IpMasterOfficialFlexibleFeatureDef = {
  featureName: IpMasterOfficialFlexibleFeatureName;
  fieldGuide: string;
  fillExample: string;
};

export const IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES: IpMasterOfficialFlexibleFeatureDef[] = [
  {
    featureName: "色彩方案",
    fieldGuide:
      "记录 IP 角色主色、辅助色、点缀色，包含色值（十六进制色号 / 潘通色号），支持多套配色方案（基础款 / 节日限定款 / 系列主题款）。",
    fillExample:
      "基础版：主色 #FFD670，辅助色 #FF8877，点缀色 #444444；圣诞限定款：主色 #E63946，辅助色 #1D3557，点缀色 #F1FAEE。",
  },
  {
    featureName: "具体形象",
    fieldGuide:
      "记录角色本体形态、物种、体型细节、造型变体的可选范围，所有变体不得改动 IP 刚性识别轮廓。",
    fillExample:
      "基础形态：拟人化小动物，圆滚滚躯体；可选变体：夏日游泳圈形态、圣诞斗篷形态、太空宇航服形态。",
  },
  {
    featureName: "五官细节",
    fieldGuide:
      "记录五官基础样式、线条风格，以及可调整的表情范围；五官造型可以变化，但五官相对位置、比例（刚性特征）不可改动。",
    fillExample:
      "基础五官：大圆黑眼珠，无高光圆眼，短弧线微笑嘴；可调整表情：开心大笑、委屈撇嘴、wink 眨眼、惊讶张嘴、发呆放空。",
  },
  {
    featureName: "配饰与服装",
    fieldGuide:
      "记录角色可更换的服饰、头饰、挂件、道具清单，包含款式、颜色、材质；基础裸型为角色本体，服饰配饰属于可替换层。",
    fillExample:
      "基础款：浅蓝色宽松卫衣；可选配饰：棒球帽、小背包、冰淇淋道具、蝴蝶结发饰。",
  },
  {
    featureName: "2D 表情包适配",
    fieldGuide:
      "记录 2D 表情包产出时允许的简化规则、线条规范、色块要求，保留全部刚性轮廓特征。",
    fillExample:
      "线条：2px 纯色轮廓线，无渐变；简化规则：可简化四肢细节，保留脸部与标志性耳朵轮廓；画布：240×240px 方形表情包。",
  },
  {
    featureName: "品牌 VI 延展",
    fieldGuide:
      "记录 IP 在品牌 VI 体系下可衍生的视觉形态、应用场景、图形处理规则。",
    fillExample:
      "可用形态：单色线稿版、扁平化矢量版、负形图形；应用场景：LOGO 辅助图形、包装印花、名片、线下门店装饰、小程序图标。",
  },
];

export function emptyOfficialFlexibleFeatures(): Array<{
  featureName: IpMasterOfficialFlexibleFeatureName;
  description: string;
}> {
  return IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map((def) => ({
    featureName: def.featureName,
    description: "",
  }));
}

/** 将草稿柔性列表对齐为官方 6 项（保留已有 description） */
export function syncTemplateFlexibleFeatures(
  template: import("@/lib/ip-master-template-types").IpMasterTemplate,
): import("@/lib/ip-master-template-types").IpMasterTemplate {
  const byName = new Map(
    template.flexibleFeatures.map((f) => [f.featureName.trim(), f.description]),
  );
  return {
    ...template,
    flexibleFeatures: IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map((def) => ({
      featureName: def.featureName,
      description: byName.get(def.featureName)?.trim() ?? "",
    })),
  };
}
