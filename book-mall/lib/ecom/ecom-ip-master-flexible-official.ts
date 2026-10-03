/** IP 母版 · 柔性特征官方 6 项（UI / LLM / 入库 SSOT） */
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

const ALIAS_TO_OFFICIAL: Record<string, IpMasterOfficialFlexibleFeatureName> = {
  色彩: "色彩方案",
  色彩系统: "色彩方案",
  配色: "色彩方案",
  形象: "具体形象",
  造型: "具体形象",
  五官: "五官细节",
  表情: "五官细节",
  服装: "配饰与服装",
  服饰: "配饰与服装",
  配饰: "配饰与服装",
  表情包: "2D 表情包适配",
  "2d表情包": "2D 表情包适配",
  vi: "品牌 VI 延展",
  品牌vi: "品牌 VI 延展",
  品牌延展: "品牌 VI 延展",
};

export function resolveOfficialFlexibleFeatureName(
  raw: string,
): IpMasterOfficialFlexibleFeatureName | null {
  const t = raw.trim();
  if ((IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES as readonly string[]).includes(t)) {
    return t as IpMasterOfficialFlexibleFeatureName;
  }
  const alias = ALIAS_TO_OFFICIAL[t.toLowerCase()] ?? ALIAS_TO_OFFICIAL[t];
  return alias ?? null;
}

export function emptyOfficialFlexibleFeatures(): Array<{
  featureName: IpMasterOfficialFlexibleFeatureName;
  description: string;
}> {
  return IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map((def) => ({
    featureName: def.featureName,
    description: "",
  }));
}

/** 将 LLM / 旧数据归一为官方 6 项（按 SSOT 顺序，合并同名） */
export function normalizeToOfficialFlexibleFeatures(
  raw: unknown,
): Array<{ featureName: IpMasterOfficialFlexibleFeatureName; description: string }> {
  const byName = new Map<IpMasterOfficialFlexibleFeatureName, string[]>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const nameRaw =
        typeof (item as { featureName?: unknown }).featureName === "string"
          ? (item as { featureName: string }).featureName
          : "";
      const desc =
        typeof (item as { description?: unknown }).description === "string"
          ? (item as { description: string }).description.trim()
          : "";
      const official = resolveOfficialFlexibleFeatureName(nameRaw);
      if (!official || !desc) continue;
      const list = byName.get(official) ?? [];
      list.push(desc);
      byName.set(official, list);
    }
  }

  return IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map((def) => {
    const parts = byName.get(def.featureName) ?? [];
    const merged = parts.join("\n").trim().slice(0, 2000);
    const description =
      merged ||
      `（请根据 Brief/基准图校对）示例风格：${def.fillExample.slice(0, 360)}`;
    return {
      featureName: def.featureName,
      description: description.slice(0, 2000),
    };
  });
}

export function isOfficialFlexibleFeaturesComplete(
  features: Array<{ featureName: string; description?: string }>,
): boolean {
  if (features.length !== IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES.length) return false;
  for (let i = 0; i < IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES.length; i++) {
    if (features[i]?.featureName !== IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES[i]) {
      return false;
    }
    if (!features[i]?.description?.trim()) return false;
  }
  return true;
}

export function buildOfficialFlexibleFeaturesPromptBlock(): string {
  const lines = IP_MASTER_OFFICIAL_FLEXIBLE_FEATURES.map(
    (def, i) =>
      `${i + 1}. featureName 固定为「${def.featureName}」
   - 官方说明：${def.fieldGuide}
   - 填写示例（仅作风格参考，须换成从用户 Brief/基准图推断的具体内容）：${def.fillExample}`,
  );
  return `flexibleFeatures 必须且仅能包含以下 6 项（顺序一致，featureName 字面完全一致）：
${lines.join("\n\n")}

柔性 description 规则：
- 写具象信息（色值 #hex、款式、变体列表、线条 px、场景清单等），禁止只写「待确认」「待补充」而不给任何推断内容。
- 禁止在 6 项里逐条重复「基准图未能识别」；缺口集中写入 pendingItems（一条即可）。
- 尚无基准图（模式 4 等）：仅据 Brief 填写能推断的具象内容；视觉细节可写 Brief 已有信息或合理推断（标注「推断」），勿编造未提及的具体色号。
- 已提供基准图且为多模态识图：必须从图中提取色彩、服装、五官、体型等填入对应项；禁止写「基准图未能识别」除非消息中确实无图片。
- 与 Brief 冲突时按输入模式优先级处理。`;
}
