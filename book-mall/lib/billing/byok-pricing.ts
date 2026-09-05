/**
 * BYOK 定价标准（财务 2.0）
 *
 * 两档月费：个人 ¥69/月；团队 ¥49/席/月（3 席起）。
 * 套餐内含月度任务额度；超出后从轻量包（通用积分池）按次扣固定积分。
 *
 * 计费类别 taxonomy 见 docs/定价与风控.md §7.1
 *
 * 超额扣分测算口径（锚定 ¥0.04/积分）：
 * - 文生图 20 积分/次 ≈ ¥0.80 — 含试衣/解析；调度+存储+出网，平台侧毛利 ≥60%
 * - 图生视频 80 积分/次 ≈ ¥3.20 — 15s 任务编排、预览缓存、队列（不含厂商费）
 * - 视频生视频 100 积分/次 ≈ ¥4.00 — 较图生视频多一轮素材读写与转码
 * - 视频理解 15 积分/次 ≈ ¥0.60 — VL 视频附件 IO + 编排
 * - TTS 12 积分/次 ≈ ¥0.48 — 同步音频落 OSS
 */
import type { ByokTaskKind } from "@prisma/client";

import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { CREDIT_TOPUP_PACKS } from "@/lib/billing/credit-topup-packs";

export const BYOK_SCOPE_PERSONAL = "personal";
export const BYOK_SCOPE_TEAM_SEAT = "team-seat";
export const BYOK_TEAM_MIN_SEATS = 3;

export const BYOK_TASK_KIND_LABEL: Record<ByokTaskKind, string> = {
  TEXT_TO_IMAGE: "文生图（含试衣）",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
  VIDEO_UNDERSTANDING: "视频理解",
  TTS: "TTS / 语音",
};

/** BYOK 超额扣次使用的积分池：视频类走 VIDEO 加量包，其余走 GENERAL 轻量包。 */
export function byokOverageCreditPool(
  taskKind: ByokTaskKind,
): "GENERAL" | "VIDEO" {
  return taskKind === "IMAGE_TO_VIDEO" || taskKind === "VIDEO_TO_VIDEO"
    ? "VIDEO"
    : "GENERAL";
}

/** 迁移前独立 TRYON 额度快照（已并入 TEXT_TO_IMAGE，勿再单独计费）。 */
export const LEGACY_TRYON_QUOTA_MONTHLY = {
  personal: 30,
  teamPerSeat: 20,
} as const;

/** 修正历史结算行里残留的 TRYON 额度快照（30/20×席 → 文生图标准额度）。 */
export function normalizeByokQuotaSettlementSnapshot(input: {
  byokTaskKind: ByokTaskKind | null | undefined;
  ownerType: "USER" | "TENANT";
  monthlyIncluded: number | null | undefined;
  includedUsedAfter: number | null | undefined;
  includedRemainingAfter: number | null | undefined;
  seats?: number;
}): {
  monthlyIncluded: number | null;
  includedUsedAfter: number | null;
  includedRemainingAfter: number | null;
  corrected: boolean;
} {
  const taskKind = input.byokTaskKind;
  const used = input.includedUsedAfter ?? null;
  const remaining = input.includedRemainingAfter ?? null;
  const monthlyIncluded = input.monthlyIncluded ?? null;

  if (taskKind !== "TEXT_TO_IMAGE" || monthlyIncluded == null) {
    return { monthlyIncluded, includedUsedAfter: used, includedRemainingAfter: remaining, corrected: false };
  }

  const scopeKey =
    input.ownerType === "TENANT" ? BYOK_SCOPE_TEAM_SEAT : BYOK_SCOPE_PERSONAL;
  const quotaDef = DEFAULT_BYOK_QUOTAS.find(
    (q) => q.scopeKey === scopeKey && q.taskKind === "TEXT_TO_IMAGE",
  );
  if (!quotaDef) {
    return { monthlyIncluded, includedUsedAfter: used, includedRemainingAfter: remaining, corrected: false };
  }

  const seats =
    input.ownerType === "TENANT"
      ? Math.max(BYOK_TEAM_MIN_SEATS, input.seats ?? BYOK_TEAM_MIN_SEATS)
      : 1;
  const expectedLimit = quotaDef.monthlyIncluded * seats;

  const isStalePersonal =
    input.ownerType === "USER" &&
    monthlyIncluded === LEGACY_TRYON_QUOTA_MONTHLY.personal;
  const isStaleTeam =
    input.ownerType === "TENANT" &&
    (monthlyIncluded === LEGACY_TRYON_QUOTA_MONTHLY.teamPerSeat * seats ||
      monthlyIncluded === LEGACY_TRYON_QUOTA_MONTHLY.teamPerSeat);

  if (!isStalePersonal && !isStaleTeam && monthlyIncluded === expectedLimit) {
    return { monthlyIncluded, includedUsedAfter: used, includedRemainingAfter: remaining, corrected: false };
  }
  if (!isStalePersonal && !isStaleTeam) {
    return { monthlyIncluded, includedUsedAfter: used, includedRemainingAfter: remaining, corrected: false };
  }

  const correctedRemaining =
    used != null ? Math.max(0, expectedLimit - used) : remaining;

  return {
    monthlyIncluded: expectedLimit,
    includedUsedAfter: used,
    includedRemainingAfter: correctedRemaining,
    corrected: true,
  };
}

export function normalizeByokFeeDescription(
  feeDescription: string,
  corrected: boolean,
  includedRemainingAfter?: number | null,
): string {
  if (!feeDescription.trim()) return feeDescription;
  let out = feeDescription;
  if (corrected) {
    out = out
      .replace(/BYOK 套餐内 · AI试衣/g, "BYOK 套餐内 · 文生图（含试衣）")
      .replace(/BYOK 超额 · AI试衣/g, "BYOK 超额 · 文生图（含试衣）");
    if (includedRemainingAfter != null) {
      out = out.replace(/套餐剩余 \d+/, `套餐剩余 ${includedRemainingAfter}`);
    }
  }
  return out;
}

/** 从 Gateway 日志解析试衣模型 key（用于明细按模型归类）。 */
export function extractTryonModelKey(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
  inputSummary?: unknown;
}): string {
  const fromSummary =
    log.inputSummary && typeof log.inputSummary === "object" && !Array.isArray(log.inputSummary)
      ? String((log.inputSummary as Record<string, unknown>).model ?? "").trim()
      : "";
  return (log.canonicalModelKey ?? log.model ?? fromSummary ?? "aitryon").trim() || "aitryon";
}

function chatMessagesFromInputSummary(inputSummary: unknown): unknown[] {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) return [];
  const input = (inputSummary as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const messages = (input as Record<string, unknown>).messages;
  return Array.isArray(messages) ? messages : [];
}

function messageContentParts(content: unknown): unknown[] {
  if (Array.isArray(content)) return content;
  if (content != null && typeof content === "object") return [content];
  return [];
}

/** CHAT 请求是否含 video_url 多模态部件（视频理解）。 */
export function hasVideoAttachmentInChatInput(inputSummary: unknown): boolean {
  for (const msg of chatMessagesFromInputSummary(inputSummary)) {
    if (!msg || typeof msg !== "object") continue;
    for (const part of messageContentParts((msg as Record<string, unknown>).content)) {
      if (!part || typeof part !== "object") continue;
      if ((part as Record<string, unknown>).type === "video_url") return true;
    }
  }
  return false;
}

function isVideoToVideoInput(inputSummary: unknown): boolean {
  const s =
    inputSummary && typeof inputSummary === "object" && !Array.isArray(inputSummary)
      ? (inputSummary as Record<string, unknown>)
      : null;
  if (!s) return false;
  const nested =
    s.input && typeof s.input === "object" && !Array.isArray(s.input)
      ? (s.input as Record<string, unknown>)
      : null;
  return Boolean(
    s.sourceVideo ||
      s.videoUrl ||
      s.referenceVideo ||
      s.mode === "v2v" ||
      s.taskType === "video2video" ||
      nested?.sourceVideo ||
      nested?.videoUrl ||
      nested?.referenceVideo ||
      nested?.mode === "v2v" ||
      nested?.taskType === "video2video",
  );
}

function videoInputRecord(inputSummary: unknown): Record<string, unknown> | null {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) {
    return null;
  }
  const root = inputSummary as Record<string, unknown>;
  const nested =
    root.input && typeof root.input === "object" && !Array.isArray(root.input)
      ? (root.input as Record<string, unknown>)
      : null;
  return nested ?? root;
}

function hasReferenceImageInVideoInput(inputSummary: unknown): boolean {
  const input = videoInputRecord(inputSummary);
  if (!input) return false;
  const imageFields = [
    "imageUrl",
    "image_url",
    "firstFrameUrl",
    "first_frame_url",
    "firstFrameImage",
    "first_frame_image",
    "imgUrl",
    "img_url",
  ];
  for (const key of imageFields) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return true;
  }
  const refArrays = [
    input.referenceImageUrls,
    input.reference_image_urls,
    input.image_urls,
    input.imageUrls,
    input.referenceImages,
    input.reference_images,
  ];
  for (const arr of refArrays) {
    if (Array.isArray(arr) && arr.some((u) => typeof u === "string" && u.trim())) {
      return true;
    }
  }
  const assetRefs = input.assetRefs ?? input.asset_refs;
  if (Array.isArray(assetRefs)) {
    for (const ref of assetRefs) {
      if (!ref || typeof ref !== "object") continue;
      const role = String((ref as Record<string, unknown>).role ?? "");
      if (role === "first_frame" || role === "last_frame" || role === "reference_image") {
        return true;
      }
    }
  }
  return false;
}

/** VIDEO 请求是否为纯文生视频（无首帧/参考图；与图生视频区分）。 */
export function isTextToVideoInput(inputSummary: unknown): boolean {
  if (isVideoToVideoInput(inputSummary)) return false;
  const input = videoInputRecord(inputSummary);
  if (!input) return false;
  if (hasReferenceImageInVideoInput(inputSummary)) return false;

  const model = String(input.model ?? "").trim().toLowerCase();
  if (
    model.includes("text-to-video") ||
    model.includes("text_to_video") ||
    model.includes("/t2v") ||
    model.endsWith("-t2v")
  ) {
    return true;
  }

  const prompt = input.prompt;
  return typeof prompt === "string" && prompt.trim().length > 0;
}

/** 将 Gateway 日志映射为 BYOK 任务类型（报表与结算共用）。纯 CHAT 文字返回 null。 */
export function mapLogToByokTaskKind(log: {
  requestKind: string;
  inputSummary?: unknown;
}): ByokTaskKind | null {
  if (log.requestKind === "TTS") return "TTS";
  if (log.requestKind === "IMAGE" || log.requestKind === "TRYON") return "TEXT_TO_IMAGE";
  if (log.requestKind === "CHAT") {
    if (hasVideoAttachmentInChatInput(log.inputSummary)) return "VIDEO_UNDERSTANDING";
    return null;
  }
  if (log.requestKind === "VIDEO") {
    if (isVideoToVideoInput(log.inputSummary)) return "VIDEO_TO_VIDEO";
    return "IMAGE_TO_VIDEO";
  }
  return null;
}

/** 平台侧单次基础设施成本估算（元，不含用户自付厂商费） */
export const BYOK_PLATFORM_COST_ESTIMATE_YUAN: Record<ByokTaskKind, number> = {
  TEXT_TO_IMAGE: 0.08,
  IMAGE_TO_VIDEO: 0.28,
  VIDEO_TO_VIDEO: 0.36,
  VIDEO_UNDERSTANDING: 0.12,
  TTS: 0.06,
};

export interface ByokQuotaSeed {
  scopeKey: string;
  taskKind: ByokTaskKind;
  label: string;
  monthlyIncluded: number;
  overageCredits: number;
}

export const DEFAULT_BYOK_CONFIGS = [
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    label: "个人 BYOK",
    techServiceFeeYuan: 69,
    minSeats: null as number | null,
    note: "已有厂商 Key；模型费自理，平台收技术服务费 + 套餐内额度",
  },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    label: "团队 BYOK（每席位）",
    techServiceFeeYuan: 49,
    minSeats: BYOK_TEAM_MIN_SEATS,
    note: `${BYOK_TEAM_MIN_SEATS} 席起订；每席独立额度，团队共享轻量包余额`,
  },
] as const;

/** 个人 / 团队（每席）默认月度额度 */
export const DEFAULT_BYOK_QUOTAS: ByokQuotaSeed[] = [
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    taskKind: "TEXT_TO_IMAGE",
    label: "文生图（含试衣）",
    monthlyIncluded: 130,
    overageCredits: 20,
  },
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    taskKind: "IMAGE_TO_VIDEO",
    label: "图生视频",
    monthlyIncluded: 20,
    overageCredits: 80,
  },
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    taskKind: "VIDEO_TO_VIDEO",
    label: "视频生视频",
    monthlyIncluded: 10,
    overageCredits: 100,
  },
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    taskKind: "VIDEO_UNDERSTANDING",
    label: "视频理解",
    monthlyIncluded: 30,
    overageCredits: 15,
  },
  { scopeKey: BYOK_SCOPE_PERSONAL, taskKind: "TTS", label: "TTS / 语音", monthlyIncluded: 40, overageCredits: 12 },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    taskKind: "TEXT_TO_IMAGE",
    label: "文生图（含试衣）",
    monthlyIncluded: 100,
    overageCredits: 20,
  },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    taskKind: "IMAGE_TO_VIDEO",
    label: "图生视频",
    monthlyIncluded: 15,
    overageCredits: 80,
  },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    taskKind: "VIDEO_TO_VIDEO",
    label: "视频生视频",
    monthlyIncluded: 8,
    overageCredits: 100,
  },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    taskKind: "VIDEO_UNDERSTANDING",
    label: "视频理解",
    monthlyIncluded: 24,
    overageCredits: 15,
  },
  { scopeKey: BYOK_SCOPE_TEAM_SEAT, taskKind: "TTS", label: "TTS / 语音", monthlyIncluded: 32, overageCredits: 12 },
];

const LEGACY_BYOK_SCOPES = ["personal-standard", "personal-pro", "team-base"];

const BYOK_QUOTA_TASK_KINDS: ByokTaskKind[] = [
  "TEXT_TO_IMAGE",
  "IMAGE_TO_VIDEO",
  "VIDEO_TO_VIDEO",
  "VIDEO_UNDERSTANDING",
  "TTS",
];

/** 定价页 / 账户权益表展示顺序（不含文字、其他）。 */
export const BYOK_QUOTA_DISPLAY_ORDER = BYOK_QUOTA_TASK_KINDS;

function quotaSortIndex(taskKind: string): number {
  const i = BYOK_QUOTA_TASK_KINDS.indexOf(taskKind as ByokTaskKind);
  return i >= 0 ? i : 999;
}

export function sortByokQuotasForDisplay<
  T extends { taskKind: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => quotaSortIndex(a.taskKind) - quotaSortIndex(b.taskKind));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export type ByokUsageScenario = {
  label: string;
  description: string;
  techFeeYuan: number;
  overageCredits: number;
  overageRevenueYuan: number;
  platformCostYuan: number;
  profitYuan: number;
  marginRate: number;
};

export function simulateByokMonth(input: {
  scopeKey: string;
  techServiceFeeYuan: number;
  seats?: number;
  quotas: { taskKind: ByokTaskKind; monthlyIncluded: number; overageCredits: number }[];
  usage: Partial<Record<ByokTaskKind, number>>;
}): ByokUsageScenario {
  const seats = Math.max(1, input.seats ?? 1);
  const techFeeYuan = round2(
    input.scopeKey === BYOK_SCOPE_TEAM_SEAT
      ? input.techServiceFeeYuan * seats
      : input.techServiceFeeYuan,
  );

  let overageCredits = 0;
  let platformCostYuan = 0;

  for (const q of input.quotas) {
    const used = Math.max(0, input.usage[q.taskKind] ?? 0);
    const included = q.monthlyIncluded * (input.scopeKey === BYOK_SCOPE_TEAM_SEAT ? seats : 1);
    const over = Math.max(0, used - included);
    overageCredits += over * q.overageCredits;
    platformCostYuan += used * BYOK_PLATFORM_COST_ESTIMATE_YUAN[q.taskKind];
  }

  const overageRevenueYuan = round2(overageCredits * DEFAULT_CREDIT_ANCHOR_YUAN);
  const totalRevenueYuan = round2(techFeeYuan + overageRevenueYuan);
  const profitYuan = round2(totalRevenueYuan - platformCostYuan);
  const marginRate = totalRevenueYuan > 0 ? round4(profitYuan / totalRevenueYuan) : 0;

  return {
    label: "",
    description: "",
    techFeeYuan,
    overageCredits,
    overageRevenueYuan,
    platformCostYuan: round2(platformCostYuan),
    profitYuan,
    marginRate,
  };
}

/** 套餐内五类任务用满时的 usage 向量（测算用）。 */
export function buildByokIncludedUsageFromQuotas(
  scopeQuotas: { taskKind: ByokTaskKind; monthlyIncluded: number }[],
  seats = 1,
): Partial<Record<ByokTaskKind, number>> {
  const usage: Partial<Record<ByokTaskKind, number>> = {};
  for (const kind of BYOK_QUOTA_TASK_KINDS) {
    const q = scopeQuotas.find((row) => row.taskKind === kind);
    if (q) usage[kind] = q.monthlyIncluded * seats;
  }
  return usage;
}

export function buildByokPricingStandards() {
  const lightPack = CREDIT_TOPUP_PACKS[0];
  return {
    anchorYuan: DEFAULT_CREDIT_ANCHOR_YUAN,
    lightPack: {
      label: lightPack.label,
      credits: lightPack.credits,
      priceYuan: lightPack.priceYuan,
    },
    platformCostEstimateYuan: BYOK_PLATFORM_COST_ESTIMATE_YUAN,
    overageRationale: [
      {
        taskKind: "TEXT_TO_IMAGE" as const,
        credits: 20,
        yuan: round2(20 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "含试衣/解析；调度 + 临时存储 + 出网；厂商生图费用户自理",
      },
      {
        taskKind: "IMAGE_TO_VIDEO" as const,
        credits: 80,
        yuan: round2(80 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "15s 视频任务编排、预览缓存、队列；厂商视频费用户自理",
      },
      {
        taskKind: "VIDEO_TO_VIDEO" as const,
        credits: 100,
        yuan: round2(100 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "双视频素材读写与转码；厂商费用户自理",
      },
      {
        taskKind: "VIDEO_UNDERSTANDING" as const,
        credits: 15,
        yuan: round2(15 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "视频附件 VL 分析 IO + 编排；厂商 token 费用户自理",
      },
      {
        taskKind: "TTS" as const,
        credits: 12,
        yuan: round2(12 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "同步 TTS + OSS；厂商语音费用户自理",
      },
    ],
  };
}

export async function buildByokFinanceReport(periodKey: string) {
  const standards = buildByokPricingStandards();
  return {
    periodKey,
    standards,
    configs: [],
    quotas: [],
    rates: [],
    observed: {
      gatewayTaskCount: 0,
      overageCreditsTotal: 0,
      vendorCostYuan: 0,
      taskByKind: {
        TEXT_TO_IMAGE: 0,
        IMAGE_TO_VIDEO: 0,
        VIDEO_TO_VIDEO: 0,
        VIDEO_UNDERSTANDING: 0,
        TTS: 0,
        OTHER: 0,
      },
      resourceFeeYuan: 0,
      resourceByType: {},
      note: "BYOK 产品已退役；历史报表仅保留定价标准参考",
    },
    ownerUsage: [],
    memberActorUsage: [],
    simulationScenarios: [],
  };
}

export async function seedByokSimplifiedPricing() {
  return;
}
