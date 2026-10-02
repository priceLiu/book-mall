import {
  BRAND_VI_STEP_IDS,
  type BrandViChatMessage,
  type BrandViProject,
  type BrandViProjectMode,
  type BrandViSlot,
  type BrandViStepId,
  type BrandViStepKind,
  type BrandViStepState,
} from "@/lib/brand-vi-types";

export type BrandViStepMeta = {
  id: BrandViStepId;
  no: number;
  label: string;
  short: string;
  kind: BrandViStepKind;
  ratio: string;
  count: number;
  requires: BrandViStepId[];
  summary: string;
};

export const BRAND_VI_STEPS: BrandViStepMeta[] = [
  {
    id: "hero",
    no: 1,
    label: "基准 IP 形象",
    short: "主",
    kind: "generate",
    ratio: "3:4",
    count: 1,
    requires: [],
    summary: "参考图或 brief 生成唯一基准形象，定稿后锁定全案",
  },
  {
    id: "turnaround",
    no: 2,
    label: "三视图规范",
    short: "视",
    kind: "generate",
    ratio: "1:1",
    count: 3,
    requires: ["hero"],
    summary: "正面 / 侧面 / 背面标准三视图",
  },
  {
    id: "emoji",
    no: 3,
    label: "九宫格表情包",
    short: "表",
    kind: "generate",
    ratio: "1:1",
    count: 9,
    requires: ["hero"],
    summary: "9 张社交商用表情，五官与基准一致",
  },
  {
    id: "logo",
    no: 4,
    label: "Logo / 头像",
    short: "标",
    kind: "generate",
    ratio: "1:1",
    count: 2,
    requires: ["hero"],
    summary: "主 Logo + 社媒头像符号",
  },
  {
    id: "merch",
    no: 5,
    label: "文创周边样机",
    short: "周",
    kind: "generate",
    ratio: "1:1",
    count: 8,
    requires: ["hero"],
    summary: "8 类周边样机整版展示",
  },
  {
    id: "poster",
    no: 6,
    label: "场景海报",
    short: "海",
    kind: "generate",
    ratio: "16:9",
    count: 4,
    requires: ["hero"],
    summary: "主海报与场景延展",
  },
  {
    id: "vi-spec",
    no: 7,
    label: "VI 规范页",
    short: "规",
    kind: "compose",
    ratio: "3:4",
    count: 1,
    requires: ["hero", "logo", "turnaround"],
    summary: "拼版 VI 规范长图",
  },
  {
    id: "portfolio",
    no: 8,
    label: "作品集长图",
    short: "集",
    kind: "compose",
    ratio: "9:16",
    count: 1,
    requires: ["hero", "emoji", "merch"],
    summary: "竖版交付作品集",
  },
];

const MODE_VISIBLE: Record<BrandViProjectMode, BrandViStepId[]> = {
  "basic-ip": ["hero", "turnaround", "emoji"],
  "emoji-only": ["hero", "emoji"],
  "vi-only": ["hero", "logo", "vi-spec"],
  "merch-only": ["hero", "merch", "poster"],
  full: [...BRAND_VI_STEP_IDS],
};

export function brandViVisibleSteps(project: BrandViProject): BrandViStepMeta[] {
  const mode = project.settings?.projectMode ?? "full";
  const ids = MODE_VISIBLE[mode] ?? MODE_VISIBLE.full;
  return BRAND_VI_STEPS.filter((s) => ids.includes(s.id));
}

export function brandViStep(id: BrandViStepId): BrandViStepMeta {
  const hit = BRAND_VI_STEPS.find((s) => s.id === id);
  if (!hit) throw new Error(`未知步骤：${id}`);
  return hit;
}

export type BrandViSheetSection = {
  title: string;
  sourceStepId?: BrandViStepId;
  sourceSlots?: number[];
  layout: "hero" | "grid" | "text";
  body?: string[];
};

export type BrandViSheetPage = {
  index: number;
  title: string;
  sections: BrandViSheetSection[];
};

export const BRAND_VI_SHEET_PAGES: Partial<Record<BrandViStepId, BrandViSheetPage[]>> = {
  "vi-spec": [
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
          ],
        },
        { title: "三视图", sourceStepId: "turnaround", layout: "grid" },
      ],
    },
  ],
  portfolio: [
    {
      index: 1,
      title: "品牌 IP 作品集",
      sections: [
        { title: "封面", sourceStepId: "hero", layout: "hero" },
        { title: "三视图", sourceStepId: "turnaround", layout: "grid" },
        { title: "表情包", sourceStepId: "emoji", layout: "grid" },
        { title: "Logo", sourceStepId: "logo", layout: "grid" },
        { title: "周边", sourceStepId: "merch", layout: "grid" },
        { title: "海报", sourceStepId: "poster", layout: "grid" },
      ],
    },
  ],
};

export function sheetPagesFor(stepId: BrandViStepId): BrandViSheetPage[] {
  return BRAND_VI_SHEET_PAGES[stepId] ?? [];
}

function fallbackGenerateSlots(step: BrandViStepMeta): BrandViSlot[] {
  return Array.from({ length: step.count }, (_, i) => ({
    index: i + 1,
    title: step.count === 1 ? step.label : `${step.label} ${i + 1}`,
    prompt: "",
  }));
}

export function stepState(project: BrandViProject, stepId: BrandViStepId): BrandViStepState {
  const meta = brandViStep(stepId);
  const existing = project.plan?.steps?.[stepId];
  if (!existing) {
    return {
      stepId,
      status: "pending",
      slots: meta.kind === "generate" ? fallbackGenerateSlots(meta) : [],
      outputs: [],
    };
  }
  if (meta.kind === "generate" && existing.slots.length === 0) {
    return { ...existing, slots: fallbackGenerateSlots(meta) };
  }
  return existing;
}

export function isStepReady(project: BrandViProject, stepId: BrandViStepId): boolean {
  const meta = brandViStep(stepId);
  const state = stepState(project, stepId);
  if (meta.kind === "compose") {
    return state.outputs.length >= meta.count && state.outputs.every((o) => o.imageUrl);
  }
  return state.slots.length > 0 && state.slots.every((s) => s.imageUrl);
}

export function doneCount(project: BrandViProject, stepId: BrandViStepId): number {
  const meta = brandViStep(stepId);
  const state = stepState(project, stepId);
  return meta.kind === "compose"
    ? state.outputs.filter((o) => o.imageUrl).length
    : state.slots.filter((s) => s.imageUrl).length;
}

export function missingRequirements(project: BrandViProject, stepId: BrandViStepId): string[] {
  if (!brandViVisibleSteps(project).some((s) => s.id === stepId)) {
    return ["当前产出模式不包含本步"];
  }
  return brandViStep(stepId)
    .requires.filter((id) => !isStepReady(project, id))
    .map((id) => `第 ${brandViStep(id).no} 步 ${brandViStep(id).label}`);
}

export function inferCurrentStepId(project: BrandViProject): BrandViStepId {
  const visible = brandViVisibleSteps(project);
  const fromMeta = project.meta?.workflow?.currentStepId;
  if (fromMeta && visible.some((s) => s.id === fromMeta)) return fromMeta;
  const firstUndone = visible.find((s) => !isStepReady(project, s.id));
  return firstUndone?.id ?? visible[visible.length - 1]!.id;
}

export function stepVisual(
  project: BrandViProject,
  stepId: BrandViStepId,
  currentStepId: BrandViStepId,
): "done" | "active" | "pending" {
  if (isStepReady(project, stepId)) return "done";
  return stepId === currentStepId ? "active" : "pending";
}

export function overallProgress(project: BrandViProject): { ready: number; total: number } {
  const visible = brandViVisibleSteps(project);
  return {
    ready: visible.filter((s) => isStepReady(project, s.id)).length,
    total: visible.length,
  };
}

export function assistantChoices(project: BrandViProject, currentStepId: BrandViStepId): string[] {
  const visible = brandViVisibleSteps(project);
  const meta = brandViStep(currentStepId);
  const ready = isStepReady(project, currentStepId);
  const idx = visible.findIndex((s) => s.id === currentStepId);
  const prev = idx > 0 ? visible[idx - 1] : undefined;
  const next = idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : undefined;

  const out: string[] = [];
  if (ready && next) {
    out.push(`进入第 ${next.no} 步：${next.label}`);
  } else {
    out.push(
      meta.kind === "compose"
        ? `确认拼版第 ${meta.no} 步：${meta.label}`
        : `确认生成第 ${meta.no} 步：${meta.label}`,
    );
  }
  out.push(`微调第 ${meta.no} 步：${meta.label}`);
  if (prev) out.push(`回到第 ${prev.no} 步：${prev.label}`);
  return out;
}

export function choicePrompt(currentStepId: BrandViStepId): string {
  const meta = brandViStep(currentStepId);
  return `当前在第 ${meta.no} 步「${meta.label}」，请选择：`;
}

export function appendUserChoice(
  history: BrandViChatMessage[],
  choice: string,
): BrandViChatMessage[] {
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

export function stepIdFromChoice(choice: string): BrandViStepId | null {
  const m = choice.match(/第\s*(\d{1,2})\s*步/);
  if (!m) return null;
  return BRAND_VI_STEPS.find((s) => s.no === Number(m[1]))?.id ?? null;
}

export const BRAND_VI_WELCOME_MESSAGE = [
  "欢迎使用品牌 VI · 表情包工作台。",
  "",
  "请上传 1～3 张角色参考图，或填写品牌/角色文字描述；选择产出模式与视觉风格后，我会分步带你完成：",
  "",
  ...BRAND_VI_STEPS.map((s) => `${s.no}. ${s.label} — ${s.summary}`),
  "",
  "第 1 步定稿的基准形象会作为后续每一步的参考图，保证五官与主色一致。",
].join("\n");

export const BRAND_VI_POST_HERO_GUIDE_MESSAGE = [
  "**基准形象已定稿**",
  "",
  "后续请在**中间工作区**按步骤自行操作：勾选槽位 → 生成；需要拼版的步骤在对应区块点「拼版」。",
  "",
  "每一步出图都会自动带上已定稿的基准形象作为参考图；成图会写入本项目并保存至「我的资产 · 品牌 VI」。",
  "",
  "右下角任务窗会显示出图进度；多步可同时排队，由系统按并发上限依次调用模型。",
].join("\n");

export function brandViStepAnchorId(stepId: BrandViStepId): string {
  return `brand-vi-step-${stepId}`;
}
