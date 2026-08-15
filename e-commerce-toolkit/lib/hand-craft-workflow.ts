import {
  HAND_CRAFT_STEP_IDS,
  type HandCraftChatMessage,
  type HandCraftProject,
  type HandCraftStepId,
  type HandCraftStepKind,
  type HandCraftStepState,
} from "@/lib/hand-craft-types";

/**
 * 步骤展示元数据（book-mall/lib/ecom/ecom-hand-craft-steps.ts 的界面镜像）。
 *
 * 这里只放 UI 需要的东西：标题、槽位数、依赖、排版结构。
 * 生图 Prompt 与基准风格串只存在于服务端，前端不复制，避免两处漂移。
 */

export type HandCraftStepMeta = {
  id: HandCraftStepId;
  no: number;
  label: string;
  short: string;
  kind: HandCraftStepKind;
  ratio: string;
  /** generate 步的槽位数 / compose 步的页数 */
  count: number;
  requires: HandCraftStepId[];
  summary: string;
};

export const HAND_CRAFT_STEPS: HandCraftStepMeta[] = [
  {
    id: "hero",
    no: 1,
    label: "核心主形象",
    short: "主",
    kind: "generate",
    ratio: "3:4",
    count: 1,
    requires: [],
    summary: "线稿转 3D 手办基准形象，定稿后锁定全系列五官与配饰",
  },
  {
    id: "spec-kit",
    no: 2,
    label: "基础规范三件套",
    short: "规",
    kind: "generate",
    ratio: "1:1",
    count: 12,
    requires: ["hero"],
    summary: "三视图 3 张 + 核心表情 4 张 + 日常动作 5 张",
  },
  {
    id: "blindbox",
    no: 3,
    label: "主题盲盒角色卡",
    short: "盒",
    kind: "generate",
    ratio: "3:4",
    count: 7,
    requires: ["hero"],
    summary: "6 款主题卡面 + 1 张系列合集预览",
  },
  {
    id: "merch",
    no: 4,
    label: "周边衍生品样机",
    short: "周",
    kind: "generate",
    ratio: "1:1",
    count: 8,
    requires: ["hero"],
    summary: "钥匙扣 / 立牌 / 帆布包 / 马克杯 / 贴纸 / 手机壳 / 眼罩 / 笔记本",
  },
  {
    id: "brand-spec",
    no: 5,
    label: "色卡与细节规范",
    short: "卡",
    kind: "generate",
    ratio: "4:5",
    count: 2,
    requires: ["hero"],
    summary: "品牌色卡规范页 + 角色细节拆解页",
  },
  {
    id: "packaging",
    no: 6,
    label: "盲盒包装盒",
    short: "装",
    kind: "generate",
    ratio: "1:1",
    count: 4,
    requires: ["hero"],
    summary: "正面 / 背面 / 盒内卡片 / 腰封",
  },
  {
    id: "emoji",
    no: 7,
    label: "九宫格表情包",
    short: "表",
    kind: "generate",
    ratio: "1:1",
    count: 9,
    requires: ["hero"],
    summary: "社交商用九宫格全场景表情",
  },
  {
    id: "xhs-long",
    no: 8,
    label: "小红书长图",
    short: "长",
    kind: "compose",
    ratio: "3:4",
    count: 1,
    requires: ["hero", "spec-kit", "blindbox", "merch", "brand-spec"],
    summary: "前序成图排版成一张竖版长图",
  },
  {
    id: "portfolio",
    no: 9,
    label: "12 页作品集",
    short: "集",
    kind: "compose",
    ratio: "3:4",
    count: 12,
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
    summary: "按设计行业标准页序装订整套作品集",
  },
  {
    id: "licensing",
    no: 10,
    label: "IP 招商授权页",
    short: "商",
    kind: "compose",
    ratio: "3:4",
    count: 1,
    requires: ["hero", "blindbox", "merch"],
    summary: "授权赛道 + 多场景角色效果，闭环全案",
  },
];

export function handCraftStep(id: HandCraftStepId): HandCraftStepMeta {
  const hit = HAND_CRAFT_STEPS.find((s) => s.id === id);
  if (!hit) throw new Error(`未知步骤：${id}`);
  return hit;
}

/* ------------------------------ 拼版版式 ------------------------------ */

export type HandCraftSheetSection = {
  title: string;
  sourceStepId?: HandCraftStepId;
  sourceSlots?: number[];
  layout: "hero" | "grid" | "text";
  body?: string[];
};

export type HandCraftSheetPage = {
  index: number;
  title: string;
  sections: HandCraftSheetSection[];
};

const PORTFOLIO_PAGES: HandCraftSheetPage[] = [
  {
    index: 1,
    title: "IP 封面扉页",
    sections: [
      { title: "封面", sourceStepId: "hero", layout: "hero" },
      {
        title: "",
        layout: "text",
        body: ["原创潮玩 IP 全案", "线稿 → 盲盒系列 → 商用授权"],
      },
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
      {
        title: "正面 / 侧面 / 背面",
        sourceStepId: "spec-kit",
        sourceSlots: [1, 2, 3],
        layout: "grid",
      },
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
    sections: [
      { title: "系列合集", sourceStepId: "blindbox", sourceSlots: [7], layout: "hero" },
    ],
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

export const HAND_CRAFT_SHEET_PAGES: Partial<Record<HandCraftStepId, HandCraftSheetPage[]>> = {
  "xhs-long": [
    {
      index: 1,
      title: "小红书竖版长图",
      sections: [
        { title: "角色档案主视觉", sourceStepId: "hero", layout: "hero" },
        {
          title: "三视图规范",
          sourceStepId: "spec-kit",
          sourceSlots: [1, 2, 3],
          layout: "grid",
        },
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
  ],
  portfolio: PORTFOLIO_PAGES,
  licensing: [
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
  ],
};

export function sheetPagesFor(stepId: HandCraftStepId): HandCraftSheetPage[] {
  return HAND_CRAFT_SHEET_PAGES[stepId] ?? [];
}

/* ------------------------------ 进度推断 ------------------------------ */

export function stepState(
  project: HandCraftProject,
  stepId: HandCraftStepId,
): HandCraftStepState {
  return (
    project.plan?.steps?.[stepId] ?? {
      stepId,
      status: "pending",
      slots: [],
      outputs: [],
    }
  );
}

export function isStepReady(project: HandCraftProject, stepId: HandCraftStepId): boolean {
  const meta = handCraftStep(stepId);
  const state = stepState(project, stepId);
  if (meta.kind === "compose") {
    return state.outputs.length >= meta.count && state.outputs.every((o) => o.imageUrl);
  }
  return state.slots.length > 0 && state.slots.every((s) => s.imageUrl);
}

export function doneCount(project: HandCraftProject, stepId: HandCraftStepId): number {
  const meta = handCraftStep(stepId);
  const state = stepState(project, stepId);
  return meta.kind === "compose"
    ? state.outputs.filter((o) => o.imageUrl).length
    : state.slots.filter((s) => s.imageUrl).length;
}

export function missingRequirements(
  project: HandCraftProject,
  stepId: HandCraftStepId,
): string[] {
  return handCraftStep(stepId)
    .requires.filter((id) => !isStepReady(project, id))
    .map((id) => `第 ${handCraftStep(id).no} 步 ${handCraftStep(id).label}`);
}

export function inferCurrentStepId(project: HandCraftProject): HandCraftStepId {
  const fromMeta = project.meta?.workflow?.currentStepId;
  if (fromMeta && HAND_CRAFT_STEP_IDS.includes(fromMeta)) return fromMeta;
  const firstUndone = HAND_CRAFT_STEPS.find((s) => !isStepReady(project, s.id));
  return firstUndone?.id ?? "licensing";
}

export function stepVisual(
  project: HandCraftProject,
  stepId: HandCraftStepId,
  currentStepId: HandCraftStepId,
): "done" | "active" | "pending" {
  if (isStepReady(project, stepId)) return "done";
  return stepId === currentStepId ? "active" : "pending";
}

export function overallProgress(project: HandCraftProject): {
  ready: number;
  total: number;
} {
  return {
    ready: HAND_CRAFT_STEPS.filter((s) => isStepReady(project, s.id)).length,
    total: HAND_CRAFT_STEPS.length,
  };
}

/* ------------------------------ 助手点选项 ------------------------------ */

export function assistantChoices(
  project: HandCraftProject,
  currentStepId: HandCraftStepId,
): string[] {
  const meta = handCraftStep(currentStepId);
  const ready = isStepReady(project, currentStepId);
  const prev = HAND_CRAFT_STEPS.find((s) => s.no === meta.no - 1);
  const next = HAND_CRAFT_STEPS.find((s) => s.no === meta.no + 1);

  const out: string[] = [];
  if (ready && next) {
    out.push(`进入第 ${next.no} 步：${next.label}`);
  } else {
    out.push(`确认生成第 ${meta.no} 步：${meta.label}`);
  }
  out.push(`微调第 ${meta.no} 步：${meta.label}`);
  if (prev) out.push(`回到第 ${prev.no} 步：${prev.label}`);
  return out;
}

export function choicePrompt(currentStepId: HandCraftStepId): string {
  const meta = handCraftStep(currentStepId);
  return `当前在第 ${meta.no} 步「${meta.label}」，请选择：`;
}

export function appendUserChoice(
  history: HandCraftChatMessage[],
  choice: string,
): HandCraftChatMessage[] {
  return [
    ...history,
    {
      id: `user-${Date.now()}`,
      role: "user",
      content: choice,
      createdAt: new Date().toISOString(),
    },
  ];
}

/** 从点选文案里解析出目标步骤，供工作区同步切换当前步 */
export function stepIdFromChoice(choice: string): HandCraftStepId | null {
  const m = choice.match(/第\s*(\d{1,2})\s*步/);
  if (!m) return null;
  return HAND_CRAFT_STEPS.find((s) => s.no === Number(m[1]))?.id ?? null;
}

export const HAND_CRAFT_WELCOME_MESSAGE = [
  "上传手绘线稿后，我会带你分 10 步做出一整套潮玩盲盒 IP 全案：",
  "",
  ...HAND_CRAFT_STEPS.map((s) => `${s.no}. ${s.label} — ${s.summary}`),
  "",
  "全程 1:1 保留线稿原生造型；第 1 步定稿的主形象会作为后续每一步的参考图，五官与配饰不会跑偏。",
  "先在中间工作区上传线稿，然后点下方按钮开始第 1 步。",
].join("\n");
