import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  BRAND_VI_HERO_LOCK,
  resolveBrandViStyleFragment,
} from "@/lib/ecom/ecom-brand-vi-style-presets";
import type { BrandViProjectMode, BrandViSettings } from "@/lib/ecom/ecom-brand-vi-types";

/**
 * 品牌 VI · 表情包 · 八步模板（唯一事实源，文档见 docs/品牌VI与表情包.md）
 */

export const BRAND_VI_VISUAL_BASE = [
  "统一 IP 画风与主色体系",
  "低饱和干净色调、柔和漫反射光影",
  "极简纯白基底，无杂物、无水印、无平台 Logo",
];

export const BRAND_VI_STEP_IDS = [
  "hero",
  "turnaround",
  "emoji",
  "logo",
  "merch",
  "poster",
  "vi-spec",
  "portfolio",
] as const;

export type BrandViStepId = (typeof BRAND_VI_STEP_IDS)[number];

export type BrandViStepKind = "generate" | "compose";

export type BrandViSlotTemplate = {
  index: number;
  title: string;
  prompt: string;
};

export type BrandViComposeSection = {
  title: string;
  sourceStepId?: BrandViStepId;
  sourceSlots?: number[];
  layout: "hero" | "grid" | "text";
  body?: string[];
};

export type BrandViComposePage = {
  index: number;
  title: string;
  sections: BrandViComposeSection[];
};

export type BrandViStepDef = {
  id: BrandViStepId;
  no: number;
  label: string;
  short: string;
  kind: BrandViStepKind;
  script: string;
  lockNote?: string;
  ratio: EcomImageRatio;
  slots: BrandViSlotTemplate[];
  pages: BrandViComposePage[];
  requires: BrandViStepId[];
};

function slots(rows: Array<[string, string]>): BrandViSlotTemplate[] {
  return rows.map(([title, prompt], i) => ({ index: i + 1, title, prompt }));
}

const TURNAROUND_SLOTS = slots([
  ["三视图 · 正面", "标准三视图之正面全身，双臂自然下垂，正视镜头，居中构图"],
  ["三视图 · 侧面", "标准三视图之正侧面全身，与正面图等高等比例，朝向画面右侧"],
  ["三视图 · 背面", "标准三视图之背面全身，完整展示发型后部与服装背面结构"],
]);

const EMOJI_SLOTS = slots([
  ["撒娇", "九宫格表情包之撒娇：双手托脸、眼睛发亮，预留顶部文字条"],
  ["生气", "九宫格表情包之生气：鼓腮叉腰、头顶怒气符号"],
  ["发呆", "九宫格表情包之发呆：眼神涣散、嘴巴微张，头顶省略号"],
  ["比心", "九宫格表情包之比心：双手在胸前比心，周围漂浮爱心"],
  ["害羞", "九宫格表情包之害羞：双颊泛红、双手捂脸偷看"],
  ["犯困", "九宫格表情包之犯困：半闭眼打哈欠，头顶 Z 字符号"],
  ["探头", "九宫格表情包之探头：从画面边框后侧探出半个身子张望"],
  ["摆手", "九宫格表情包之摆手：抬手摆手告别，身体微侧"],
  ["飞吻", "九宫格表情包之飞吻：单手送出飞吻，唇印飘向镜头"],
]);

const LOGO_SLOTS = slots([
  ["主 Logo", "品牌主 Logo：从角色头部提炼识别符号，横版构图，主色与角色一致，纯白背景"],
  ["头像符号", "社媒头像版 Logo：圆形或方形裁切友好，高识别度，纯白背景"],
]);

const MERCH_SLOTS = slots([
  ["钥匙扣", "亚克力钥匙扣样机：IP 立绘半身异形切边，配金属扣环，白底产品展示"],
  ["亚克力立牌", "亚克力立牌样机：IP 全身立绘 + 透明底座，45 度产品视角"],
  ["帆布包", "帆布包样机：IP 主视觉印在袋身正中，米白帆布材质，正面平铺展示"],
  ["马克杯", "陶瓷马克杯样机：IP 环绕印花，白瓷杯身，45 度产品视角"],
  ["贴纸", "模切贴纸样机：同一 IP 的多个表情与动作组成贴纸排版，白底展示"],
  ["手机壳", "手机壳样机：IP 主视觉居中印刷，哑面壳体，正面产品展示"],
  ["眼罩", "真丝眼罩样机：IP 慵懒闭眼形象印在罩面，配松紧带，平铺展示"],
  ["笔记本", "精装笔记本样机：IP 主视觉压印封面，配腰封，斜放产品展示"],
]);

const POSTER_SLOTS = slots([
  ["主海报", "品牌主视觉海报：角色全身居中，留白标题区，适合线下与社媒首图"],
  ["场景海报 A", "生活场景海报：角色与产品/道具互动，柔和景深，品牌主色点缀"],
  ["场景海报 B", "活动场景海报：角色动态姿势，节日或促销氛围，保持 IP 五官不变"],
  ["横版 Banner", "横版 Banner：角色半身 + 品牌 Slogan 占位区，16:9 构图"],
]);

const VI_SPEC_PAGES: BrandViComposePage[] = [
  {
    index: 1,
    title: "品牌 VI 规范页",
    sections: [
      { title: "基准形象", sourceStepId: "hero", layout: "hero" },
      { title: "主 Logo", sourceStepId: "logo", sourceSlots: [1], layout: "grid" },
      {
        title: "规范说明",
        layout: "text",
        body: [
          "主色 / 辅助色 / 点缀色由基准形象与 Logo 统一",
          "三视图与表情包须与基准形象五官、配饰一致",
          "周边与海报仅更换场景与载体，不改变角色本体",
        ],
      },
      { title: "三视图", sourceStepId: "turnaround", layout: "grid" },
    ],
  },
];

const PORTFOLIO_PAGES: BrandViComposePage[] = [
  {
    index: 1,
    title: "品牌 IP 作品集",
    sections: [
      { title: "封面", sourceStepId: "hero", layout: "hero" },
      { title: "", layout: "text", body: ["品牌 IP VI 与表情包交付", "基准形象 · 延展物料 · 商用规范"] },
      { title: "三视图", sourceStepId: "turnaround", layout: "grid" },
      { title: "表情包", sourceStepId: "emoji", layout: "grid" },
      { title: "Logo", sourceStepId: "logo", layout: "grid" },
      { title: "周边", sourceStepId: "merch", layout: "grid" },
      { title: "海报", sourceStepId: "poster", layout: "grid" },
    ],
  },
];

/** 各产出模式下进度轨可见步骤 */
const MODE_VISIBLE: Record<BrandViProjectMode, BrandViStepId[]> = {
  "basic-ip": ["hero", "turnaround", "emoji"],
  "emoji-only": ["hero", "emoji"],
  "vi-only": ["hero", "logo", "vi-spec"],
  "merch-only": ["hero", "merch", "poster"],
  full: [...BRAND_VI_STEP_IDS],
};

export function brandViVisibleStepIds(mode: BrandViProjectMode | undefined): BrandViStepId[] {
  return MODE_VISIBLE[mode ?? "full"];
}

export function isBrandViStepVisible(
  stepId: BrandViStepId,
  mode: BrandViProjectMode | undefined,
): boolean {
  return brandViVisibleStepIds(mode).includes(stepId);
}

export const BRAND_VI_STEPS: BrandViStepDef[] = [
  {
    id: "hero",
    no: 1,
    label: "基准 IP 形象",
    short: "主",
    kind: "generate",
    script:
      "第一步：生成并确认唯一基准 IP 形象。有参考图则 1:1 规范化；仅文字 brief 则按品牌气质生成。确认定稿后锁定全案五官与主色。",
    lockNote: "本图为全系列唯一基准，后续所有物料须与此完全一致。",
    ratio: "3:4",
    slots: slots([
      [
        "基准主形象",
        "全身正面标准站姿，居中构图，品牌主色，柔和光影，纯白背景，作为全系列唯一基准形象",
      ],
    ]),
    pages: [],
    requires: [],
  },
  {
    id: "turnaround",
    no: 2,
    label: "三视图规范",
    short: "视",
    kind: "generate",
    script: "基准已锁定。生成正面 / 侧面 / 背面标准三视图，等高等比例，是否开始？",
    ratio: "1:1",
    slots: TURNAROUND_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "emoji",
    no: 3,
    label: "九宫格表情包",
    short: "表",
    kind: "generate",
    script: "批量生成 9 张社交商用表情包，五官与基准一致，仅换表情与姿态。确认生成？",
    ratio: "1:1",
    slots: EMOJI_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "logo",
    no: 4,
    label: "Logo / 头像",
    short: "标",
    kind: "generate",
    script: "从角色提炼主 Logo 与社媒头像符号，主色与基准一致。确认生成？",
    ratio: "1:1",
    slots: LOGO_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "merch",
    no: 5,
    label: "文创周边样机",
    short: "周",
    kind: "generate",
    script: "延展 8 类文创周边样机整版展示，统一 IP 视觉。确认生成？",
    ratio: "1:1",
    slots: MERCH_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "poster",
    no: 6,
    label: "场景海报",
    short: "海",
    kind: "generate",
    script: "生成主海报与场景延展海报，角色本体不变。确认生成？",
    ratio: "16:9",
    slots: POSTER_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "vi-spec",
    no: 7,
    label: "VI 规范页",
    short: "规",
    kind: "compose",
    script: "拼版 VI 规范长图：基准形象 + Logo + 三视图 + 文字规范说明。确认拼版？",
    ratio: "3:4",
    slots: [],
    pages: VI_SPEC_PAGES,
    requires: ["hero", "logo", "turnaround"],
  },
  {
    id: "portfolio",
    no: 8,
    label: "作品集长图",
    short: "集",
    kind: "compose",
    script: "拼版竖版作品集长图，汇总已生成模块，用于交付展示。确认拼版？",
    ratio: "9:16",
    slots: [],
    pages: PORTFOLIO_PAGES,
    requires: ["hero", "emoji", "merch"],
  },
];

export function isBrandViStepId(input: unknown): input is BrandViStepId {
  return typeof input === "string" && (BRAND_VI_STEP_IDS as readonly string[]).includes(input);
}

export function getBrandViStep(id: string): BrandViStepDef | null {
  return BRAND_VI_STEPS.find((s) => s.id === id) ?? null;
}

export function requireBrandViStep(id: string): BrandViStepDef {
  const step = getBrandViStep(id);
  if (!step) throw new Error(`未知步骤：${id}`);
  return step;
}

export function buildBrandViSlotPrompt(opts: {
  step: BrandViStepDef;
  slotTitle: string;
  slotPrompt: string;
  refCount: number;
  isHeroStep: boolean;
  settings?: BrandViSettings;
}): string {
  const styleFragment = resolveBrandViStyleFragment(opts.settings);
  const lines: string[] = [
    `生成 ${opts.step.ratio} 比例的品牌 IP 物料：${opts.step.label} · ${opts.slotTitle}`,
    "",
    opts.slotPrompt,
    "",
    "固定视觉基底：",
    ...BRAND_VI_VISUAL_BASE.map((r) => `- ${r}`),
    "",
    `基准一致性（硬性）：${BRAND_VI_HERO_LOCK}`,
    "",
    `视觉风格（硬性）：${styleFragment}`,
  ];

  if (opts.refCount > 0) {
    lines.push("", "参考图说明（硬性要求，优先级高于上文）：");
    if (opts.isHeroStep) {
      lines.push(
        "- 参考图为用户角色参考：须保留参考图的造型、发型、配饰、服装与体态，不得随意改动原生结构",
        "- 无参考图时按 brief 生成，定稿后即为全案唯一基准",
      );
    } else {
      lines.push(
        "- 参考图第 1 张为本系列基准主形象：五官、发型、核心配饰与身体比例必须与之完全一致",
        "- 不得改动基准形象的脸部特征与核心配饰，只按本槽指令更换姿态、场景或载体",
      );
      if (opts.refCount > 1) {
        lines.push("- 其余参考图为同系列已定稿物料，仅用于统一材质与配色，不改变角色本体");
      }
    }
  }

  return lines.join("\n");
}
