import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

/**
 * 手伴创作 · 10 步模板表（唯一事实源，文档见 doc/手伴/skill.md）
 *
 * 全流程只有两种步骤形态：
 * - generate：一组槽位各出一张图，走同一条出图管线
 * - compose：不调生图模型，把前序成图按固定版式拼成长图 / 页图
 */

/**
 * 兜底基准风格串（文档「通用生成 Prompt」原文）。
 *
 * 每一条送给生图模型的 Prompt 都必须拼上它：10 步之间的五官一致性完全靠
 * 「第 1 步定稿主形象作参考图」+「本串」锁定，只写进助手话术是无效的。
 */
export const HAND_CRAFT_BASE_STYLE =
  "严格沿用本次线稿原生造型，100%保留卷发、星星发饰、波点裙、五官雀斑与体态，泡泡玛特潮玩3D手办，哑光细腻树脂材质，圆润软萌比例，干净红白主色调，柔和渐变光影，无杂色纯白背景，潮玩精致细节，统一IP五官特征不崩脸";

/** 全程固定视觉基底（文档「通用纠错&灵活调整规则」第 4 条） */
export const HAND_CRAFT_VISUAL_BASE = [
  "泡泡玛特软胶手办质感、圆润 Q 版比例",
  "低饱和干净色调、柔和漫反射光影",
  "极简纯白基底，无杂物、无水印、无平台 Logo",
];

export const HAND_CRAFT_STEP_IDS = [
  "hero",
  "spec-kit",
  "blindbox",
  "merch",
  "brand-spec",
  "packaging",
  "emoji",
  "xhs-long",
  "portfolio",
  "licensing",
] as const;

export type HandCraftStepId = (typeof HAND_CRAFT_STEP_IDS)[number];

export type HandCraftStepKind = "generate" | "compose";

export type HandCraftSlotTemplate = {
  index: number;
  title: string;
  /** 本槽差异化指令；最终 Prompt 由 buildHandCraftSlotPrompt 拼装 */
  prompt: string;
};

export type HandCraftComposeSection = {
  title: string;
  /** 取哪一步的成图；缺省表示纯文字段落 */
  sourceStepId?: HandCraftStepId;
  /** 取该步的槽位序号；缺省表示取全部 */
  sourceSlots?: number[];
  layout: "hero" | "grid" | "text";
  body?: string[];
};

export type HandCraftComposePage = {
  index: number;
  title: string;
  sections: HandCraftComposeSection[];
};

export type HandCraftStepDef = {
  id: HandCraftStepId;
  /** 文档里的第 N 步 */
  no: number;
  label: string;
  /** 进度轨单字 */
  short: string;
  kind: HandCraftStepKind;
  /** 助手在本步发送的固定话术（文档原文） */
  script: string;
  /** 本步定稿后助手补充的锁定说明 */
  lockNote?: string;
  ratio: EcomImageRatio;
  /** generate 步的槽位模板 */
  slots: HandCraftSlotTemplate[];
  /** compose 步的页面版式 */
  pages: HandCraftComposePage[];
  /** 依赖哪些步骤已出图，未齐备则本步不可执行 */
  requires: HandCraftStepId[];
};

function slots(rows: Array<[string, string]>): HandCraftSlotTemplate[] {
  return rows.map(([title, prompt], i) => ({ index: i + 1, title, prompt }));
}

const SPEC_KIT_SLOTS = slots([
  ["三视图 · 正面", "标准三视图之正面全身，双臂自然下垂，正视镜头，居中构图"],
  ["三视图 · 侧面", "标准三视图之正侧面全身，与正面图等高等比例，朝向画面右侧"],
  ["三视图 · 背面", "标准三视图之背面全身，完整展示发型后部与服装背面结构"],
  ["表情 · 开心", "半身特写，开心表情：眼睛弯成月牙、嘴角上扬露齿笑"],
  ["表情 · 委屈", "半身特写，委屈表情：眼角下垂、嘴巴微扁、眼中带光"],
  ["表情 · 惊讶", "半身特写，惊讶表情：眼睛睁大、嘴巴呈小圆形"],
  ["表情 · 慵懒", "半身特写，慵懒表情：半闭眼、微微歪头、放松神态"],
  ["动作 1 · 站立招手", "全身日常站姿，一手抬起招手，重心自然"],
  ["动作 2 · 双手背后", "全身日常站姿，双手背在身后，脚跟并拢"],
  ["动作 3 · 抱膝坐姿", "全身坐姿，抱膝坐在地面，头部微侧"],
  ["动作 4 · 转身回望", "全身站姿，身体半转、头部回望镜头"],
  ["动作 5 · 双手比心", "全身站姿，双手在胸前比心，脚尖内八"],
]);

const BLINDBOX_THEMES: Array<[string, string]> = [
  ["甜点主题", "甜点主题穿搭：马卡龙色系围裙与厨师帽，手持奶油裱花袋，背景点缀甜点元素"],
  ["森系主题", "森系主题穿搭：草木绿斗篷与蘑菇小包，背景点缀蕨叶与松果"],
  ["居家主题", "居家主题穿搭：绒感睡衣与拖鞋，怀抱抱枕，背景点缀暖灯与小夜灯"],
  ["田园主题", "田园主题穿搭：格纹背带裙与草编帽，手提花篮，背景点缀花田"],
  ["假日主题", "假日主题穿搭：度假衬衫与草帽墨镜，手拿椰子饮品，背景点缀海浪与遮阳伞"],
  ["冬日主题", "冬日主题穿搭：厚织毛衣、围巾与耳罩，捧热饮，背景点缀雪花"],
];

const BLINDBOX_CARD_RULE =
  "红白色潮玩盲盒卡片版式，单人立绘居中，卡片四周留白与主题图标装饰；人物脸部、卷发、星星发饰、雀斑完全不变，仅更换穿搭与场景主题";

const BLINDBOX_SLOTS: HandCraftSlotTemplate[] = [
  ...BLINDBOX_THEMES.map(([title, prompt], i) => ({
    index: i + 1,
    title: `盲盒卡 ${i + 1} · ${title}`,
    prompt: `${prompt}。${BLINDBOX_CARD_RULE}`,
  })),
  {
    index: 7,
    title: "盲盒合集预览图",
    prompt:
      "6 款主题盲盒角色一字排开的合集预览图，同一水平线等高排列，统一红白潮玩底版与标题条，展示系列完整度",
  },
];

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

const BRAND_SPEC_SLOTS = slots([
  [
    "品牌色卡规范页",
    "品牌标准化色卡规范页：主色、辅助色、点缀色三组色块横向排列，每块下方标注色值占位与用途说明，排版留白干净",
  ],
  [
    "角色细节拆解页",
    "角色细节拆解页：头部发型、服装版型、肢体细节三组局部放大图 + 引线标注，用于全物料统一管控",
  ],
]);

const PACKAGING_SLOTS = slots([
  ["包装盒正面", "盲盒外包装盒正面效果图：IP 主视觉居中开窗，红白主色，顶部系列名占位"],
  ["包装盒背面", "盲盒外包装盒背面效果图：6 款角色小图矩阵 + 条码与说明区块占位"],
  ["盒内卡片", "盲盒盒内收藏卡片正面：单角色立绘 + 编号与系列徽标占位"],
  ["腰封", "盲盒包装腰封展开图：横向长条版式，重复主视觉与系列名占位"],
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

const XHS_LONG_PAGES: HandCraftComposePage[] = [
  {
    index: 1,
    title: "小红书竖版长图",
    sections: [
      { title: "角色档案主视觉", sourceStepId: "hero", layout: "hero" },
      { title: "三视图规范", sourceStepId: "spec-kit", sourceSlots: [1, 2, 3], layout: "grid" },
      {
        title: "表情与动作",
        sourceStepId: "spec-kit",
        sourceSlots: [4, 5, 6, 7, 8, 9, 10, 11, 12],
        layout: "grid",
      },
      {
        title: "盲盒系列预览",
        sourceStepId: "blindbox",
        sourceSlots: [1, 2, 3, 4, 5, 6],
        layout: "grid",
      },
      { title: "周边衍生品样机", sourceStepId: "merch", layout: "grid" },
      { title: "品牌色卡与细节规范", sourceStepId: "brand-spec", layout: "grid" },
    ],
  },
];

/** 文档第 9 步固定页序，不可调整 */
const PORTFOLIO_PAGES: HandCraftComposePage[] = [
  {
    index: 1,
    title: "IP 封面扉页",
    sections: [
      { title: "封面", sourceStepId: "hero", layout: "hero" },
      { title: "", layout: "text", body: ["原创潮玩 IP 全案", "线稿 → 盲盒系列 → 商用授权"] },
    ],
  },
  {
    index: 2,
    title: "角色档案主视觉",
    sections: [{ title: "基准主形象", sourceStepId: "hero", layout: "hero" }],
  },
  {
    index: 3,
    title: "三视图规范",
    sections: [
      { title: "正面 / 侧面 / 背面", sourceStepId: "spec-kit", sourceSlots: [1, 2, 3], layout: "grid" },
    ],
  },
  {
    index: 4,
    title: "表情动作页",
    sections: [
      {
        title: "核心情绪与日常动作",
        sourceStepId: "spec-kit",
        sourceSlots: [4, 5, 6, 7, 8, 9, 10, 11, 12],
        layout: "grid",
      },
    ],
  },
  {
    index: 5,
    title: "色卡细节页",
    sections: [{ title: "色卡与细节拆解", sourceStepId: "brand-spec", layout: "grid" }],
  },
  {
    index: 6,
    title: "盲盒合集页",
    sections: [{ title: "系列合集", sourceStepId: "blindbox", sourceSlots: [7], layout: "hero" }],
  },
  {
    index: 7,
    title: "单盲盒分页",
    sections: [
      {
        title: "6 款主题独立卡面",
        sourceStepId: "blindbox",
        sourceSlots: [1, 2, 3, 4, 5, 6],
        layout: "grid",
      },
    ],
  },
  {
    index: 8,
    title: "周边衍生品页",
    sections: [{ title: "全品类样机", sourceStepId: "merch", layout: "grid" }],
  },
  {
    index: 9,
    title: "包装效果图页",
    sections: [{ title: "盲盒包装", sourceStepId: "packaging", layout: "grid" }],
  },
  {
    index: 10,
    title: "九宫格表情包页",
    sections: [{ title: "社交商用表情包", sourceStepId: "emoji", layout: "grid" }],
  },
  {
    index: 11,
    title: "小红书长图",
    sections: [{ title: "作品集长图", sourceStepId: "xhs-long", layout: "hero" }],
  },
  {
    index: 12,
    title: "版权封底页",
    sections: [
      {
        title: "",
        layout: "text",
        body: [
          "本 IP 全案物料均由本项目原创设计",
          "未经授权不得用于商业复制、二次分发或模型训练",
          "商务合作请联系版权方",
        ],
      },
    ],
  },
];

const LICENSING_PAGES: HandCraftComposePage[] = [
  {
    index: 1,
    title: "IP 招商授权落地页",
    sections: [
      { title: "IP 主视觉", sourceStepId: "hero", layout: "hero" },
      {
        title: "开放授权赛道",
        layout: "text",
        body: [
          "盲盒联名 · 整套 6 款主题可直接开模",
          "文创周边 · 8 大品类样机已完成",
          "线下快闪 · 提供主视觉与场景延展",
          "服饰跨界 · 支持印花与版型联名",
          "美妆合作 · 支持包装与礼盒联名",
          "表情包商用 · 九宫格全场景已交付",
        ],
      },
      {
        title: "多场景角色效果",
        sourceStepId: "blindbox",
        sourceSlots: [1, 2, 3, 4, 5, 6],
        layout: "grid",
      },
      { title: "可落地周边", sourceStepId: "merch", layout: "grid" },
    ],
  },
];

export const HAND_CRAFT_STEPS: HandCraftStepDef[] = [
  {
    id: "hero",
    no: 1,
    label: "核心主形象",
    short: "主",
    kind: "generate",
    script:
      "第一步，先生成 IP 基准主图：泡泡玛特哑光树脂 3D 手办、明亮干净红白配色、柔和光影、纯白背景标准站姿形象。确认无误我就开始渲染定稿？",
    lockNote:
      "本图为全系列唯一基准形象，后续所有延展造型、五官、卷发、配饰均以此锁定，不会跑偏变形。",
    ratio: "3:4",
    slots: slots([
      [
        "基准主形象",
        "全身正面标准站姿，居中构图，明亮干净红白配色，柔和光影，纯白背景，作为全系列唯一基准形象",
      ],
    ]),
    pages: [],
    requires: [],
  },
  {
    id: "spec-kit",
    no: 2,
    label: "基础规范三件套",
    short: "规",
    kind: "generate",
    script:
      "基准主形象已锁定，接下来批量产出 IP 基础规范物料：正面/侧面/背面标准三视图、4 款核心情绪表情（开心/委屈/惊讶/慵懒）、5 个日常站姿动作。统一材质色调，是否直接生成？",
    ratio: "1:1",
    slots: SPEC_KIT_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "blindbox",
    no: 3,
    label: "主题盲盒角色卡",
    short: "盒",
    kind: "generate",
    script:
      "基础规范完成，现在制作核心商业盲盒系列。人物脸部、卷发、星星发饰完全不变，仅更换穿搭 + 场景主题，设计 6 套差异化单人盲盒卡片（甜点、森系、居家、田园、假日、冬日），红白色潮玩卡片版式。需要直接生成全套 6 张独立卡面吗？",
    ratio: "3:4",
    slots: BLINDBOX_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "merch",
    no: 4,
    label: "周边衍生品样机",
    short: "周",
    kind: "generate",
    script:
      "盲盒系列定稿，延展可落地商用周边：钥匙扣、亚克力立牌、帆布包、马克杯、贴纸、手机壳、眼罩、笔记本，统一 IP 视觉做整版样机展示图。是否生成整合大图？",
    ratio: "1:1",
    slots: MERCH_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "brand-spec",
    no: 5,
    label: "色卡与细节规范",
    short: "卡",
    kind: "generate",
    script:
      "制作品牌标准化落地手册页，包含主色/辅助色/点缀色色卡标注、头部发型/服装版型/肢体细节拆解图，用于全物料统一管控。确认生成规范页？",
    ratio: "4:5",
    slots: BRAND_SPEC_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "packaging",
    no: 6,
    label: "盲盒包装盒",
    short: "装",
    kind: "generate",
    script:
      "设计盲盒外包装盒正面、背面、盒内卡片、腰封整套版式，匹配 IP 主视觉，满足实物开模生产需求。是否渲染包装效果图？",
    ratio: "1:1",
    slots: PACKAGING_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "emoji",
    no: 7,
    label: "九宫格表情包",
    short: "表",
    kind: "generate",
    script:
      "在 4 个基础表情上扩容为九宫格全场景表情包，覆盖撒娇、生气、发呆、比心、害羞、犯困、探头、摆手等日常场景，适配微信、小红书、短视频配图。需要扩写全套表情包吗？",
    ratio: "1:1",
    slots: EMOJI_SLOTS,
    pages: [],
    requires: ["hero"],
  },
  {
    id: "xhs-long",
    no: 8,
    label: "小红书长图",
    short: "长",
    kind: "compose",
    script:
      "对标爆款参考版式，将三视图、角色档案、盲盒预览、周边样机、色卡规范整合为一张竖版长图，适合直接发布作品集、接单展示。确认排版制作？",
    ratio: "3:4",
    slots: [],
    pages: XHS_LONG_PAGES,
    requires: ["hero", "spec-kit", "blindbox", "merch", "brand-spec"],
  },
  {
    id: "portfolio",
    no: 9,
    label: "12 页作品集",
    short: "集",
    kind: "compose",
    script:
      "把前面所有物料，按设计行业标准排序，装订为 12 页完整作品集，固定页码顺序：1. IP 封面扉页 2. 角色档案主视觉 3. 三视图规范 4. 表情动作页 5. 色卡细节页 6. 盲盒合集页 7. 6 张单盲盒分页 8. 周边衍生品页 9. 包装效果图页 10. 九宫格表情包页 11. 小红书长图 12. 版权封底页。是否按该统一版式生成整套作品集框架？",
    ratio: "3:4",
    slots: [],
    pages: PORTFOLIO_PAGES,
    requires: [
      "hero",
      "spec-kit",
      "blindbox",
      "merch",
      "brand-spec",
      "packaging",
      "emoji",
      "xhs-long",
    ],
  },
  {
    id: "licensing",
    no: 10,
    label: "IP 招商授权页",
    short: "商",
    kind: "compose",
    script:
      "最后制作 IP 招商合作单页，明确授权赛道：盲盒联名、文创周边、线下快闪、服饰跨界、美妆合作、表情包商用，搭配多场景角色效果图，用于对接品牌方、供应链、渠道招商，闭环整套 IP 全案。确认制作收尾招商页？",
    ratio: "3:4",
    slots: [],
    pages: LICENSING_PAGES,
    requires: ["hero", "blindbox", "merch"],
  },
];

export function isHandCraftStepId(input: unknown): input is HandCraftStepId {
  return (
    typeof input === "string" &&
    (HAND_CRAFT_STEP_IDS as readonly string[]).includes(input)
  );
}

export function getHandCraftStep(id: string): HandCraftStepDef | null {
  return HAND_CRAFT_STEPS.find((s) => s.id === id) ?? null;
}

export function requireHandCraftStep(id: string): HandCraftStepDef {
  const step = getHandCraftStep(id);
  if (!step) throw new Error(`未知步骤：${id}`);
  return step;
}

/**
 * 拼装单槽最终 Prompt。
 *
 * 顺序固定：本步定位 → 本槽差异化指令 → 视觉基底 → 基准风格串 → 参考图说明。
 * 参考图说明放最后，模型才知道第 1 张是必须 1:1 沿用的基准主形象。
 */
export function buildHandCraftSlotPrompt(opts: {
  step: HandCraftStepDef;
  slotTitle: string;
  slotPrompt: string;
  /** 参考图张数（第 1 张恒为基准主形象，hero 步除外） */
  refCount: number;
  /** hero 步的参考图是用户上传的线稿 */
  isHeroStep: boolean;
}): string {
  const lines: string[] = [
    `生成 ${opts.step.ratio} 比例的潮玩 IP 物料：${opts.step.label} · ${opts.slotTitle}`,
    "",
    opts.slotPrompt,
    "",
    "固定视觉基底：",
    ...HAND_CRAFT_VISUAL_BASE.map((r) => `- ${r}`),
    "",
    `基准风格（硬性）：${HAND_CRAFT_BASE_STYLE}`,
  ];

  if (opts.refCount > 0) {
    lines.push("", "参考图说明（硬性要求，优先级高于上文）：");
    if (opts.isHeroStep) {
      lines.push(
        "- 参考图为用户手绘线稿：须 1:1 保留线稿的造型、发型、配饰、服装与体态细节，不得随意改动原生结构",
        "- 只把线稿转成 3D 手办质感，不新增、不删减线稿里的任何元素",
      );
    } else {
      lines.push(
        "- 参考图第 1 张为本系列基准主形象：五官、发型、卷发、星星发饰、雀斑与身体比例必须与之完全一致",
        "- 不得改动基准形象的脸部特征与核心配饰，只按本槽指令更换姿态、穿搭或载体",
      );
      if (opts.refCount > 1) {
        lines.push("- 其余参考图为同系列已定稿物料，仅用于统一材质与配色，不改变角色本体");
      }
    }
  }

  return lines.join("\n");
}
