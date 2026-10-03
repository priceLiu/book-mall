import { z } from "zod";

import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  BRAND_VI_STEP_IDS,
  type BrandViStepId,
} from "@/lib/ecom/ecom-brand-vi-steps";

export const ECOM_BRAND_VI_TOOL_KEY = "ecom-toolkit__vi";
export const ECOM_BRAND_VI_MODULE = "vi";
export const ECOM_BRAND_VI_GENERATE_ACTION = "generate";
export const ECOM_BRAND_VI_COMPOSE_ACTION = "compose";
export const ECOM_BRAND_VI_SKETCH_GENERATE_ACTION = "sketch-generate";

/** AI 生成线稿默认模型（通义万相 2.7 多图参考） */
export const BRAND_VI_SKETCH_GEN_MODEL = "wan2.7-image";

/** 生成线稿弹窗默认 Prompt（用户可改） */
export const BRAND_VI_SKETCH_GEN_DEFAULT_PROMPT =
  "手绘铅笔画卷发女孩 基于这个IP草图，保持所有细节不变，生成泡泡玛特风格，3D卡通角色，高清可爱，明亮干净的色调，柔和光影过渡塑造简洁现代的视觉氛围，手办，纯白色背景";

/** 线稿最多 3 张（正面 + 补充角度） */
export const BRAND_VI_SKETCH_MAX = 3;

export type BrandViChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
};

/** 角色参考图（线稿 / 立绘 / 头像），最多 3 张 */
export type BrandViReference = {
  id: string;
  label: string;
  role: "reference";
  ossUrl: string;
};

export type BrandViBrief = {
  brandName?: string;
  characterDescription?: string;
  primaryColorHint?: string;
};

export const BRAND_VI_PROJECT_MODES = [
  "basic-ip",
  "emoji-only",
  "vi-only",
  "merch-only",
  "full",
] as const;

export type BrandViProjectMode = (typeof BRAND_VI_PROJECT_MODES)[number];

export type BrandViSlot = {
  index: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  /** 用户手改过 Prompt：重置本步时保留 */
  promptEdited?: boolean;
};

export type BrandViComposeOutput = {
  index: number;
  title: string;
  imageUrl: string;
  assetId?: string;
};

export type BrandViStepState = {
  stepId: BrandViStepId;
  status: "pending" | "generating" | "ready";
  slots: BrandViSlot[];
  /** compose 步的拼版产出 */
  outputs: BrandViComposeOutput[];
  updatedAt?: string;
};

export type BrandViPlan = {
  steps: Partial<Record<BrandViStepId, BrandViStepState>>;
};

export type BrandViSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  /** 批量出图并发（1–5） */
  imageGenConcurrency?: number;
  stylePresetId?: string;
  styleCustomText?: string;
  projectMode?: BrandViProjectMode;
  ipMasterProjectId?: string;
  ipMasterVersion?: string;
  referenceFromIpMaster?: boolean;
};

export type BrandViMeta = {
  workflow?: {
    /** 当前进行到哪一步 */
    currentStepId?: BrandViStepId;
    /** 第 1 步定稿后锁定的基准主形象，后续每步作参考图 */
    heroLockedUrl?: string;
  };
  lastAssistantRaw?: string;
  workflowSnapshot?: unknown;
  workflowSnapshotHistory?: unknown[];
  reusedFrom?: { savedAt: string; title: string; at: string };
};

const slotSchema = z.object({
  index: z.number().int().positive(),
  title: z.string().min(1),
  prompt: z.string().default(""),
  imageUrl: z.string().optional(),
  assetId: z.string().optional(),
  promptEdited: z.boolean().optional(),
});

const composeOutputSchema = z.object({
  index: z.number().int().positive(),
  title: z.string().default(""),
  imageUrl: z.string().min(1),
  assetId: z.string().optional(),
});

export const brandViStepStateSchema = z.object({
  stepId: z.enum(BRAND_VI_STEP_IDS),
  status: z.enum(["pending", "generating", "ready"]).default("pending"),
  slots: z.array(slotSchema).default([]),
  outputs: z.array(composeOutputSchema).default([]),
  updatedAt: z.string().optional(),
});

/**
 * 逐 key 解析：整体 z.record + enum key 在 zod 3 会把 steps 推成「全 key 必填」，
 * 与 Partial 语义不符，因此这里手动挑出合法步骤，坏数据丢弃而不是整份 plan 作废。
 */
export function parseBrandViPlan(raw: unknown): BrandViPlan {
  const steps: BrandViPlan["steps"] = {};
  const rawSteps =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ((raw as Record<string, unknown>).steps as unknown)
      : null;
  if (rawSteps && typeof rawSteps === "object" && !Array.isArray(rawSteps)) {
    for (const [key, value] of Object.entries(rawSteps as Record<string, unknown>)) {
      if (!(BRAND_VI_STEP_IDS as readonly string[]).includes(key)) continue;
      const parsed = brandViStepStateSchema.safeParse({ stepId: key, ...(value as object) });
      if (!parsed.success) continue;
      steps[key as BrandViStepId] = parsed.data as BrandViStepState;
    }
  }
  return { steps };
}

export function emptyBrandViPlan(): BrandViPlan {
  return { steps: {} };
}

export function sanitizeBrandViReferences(raw: unknown): BrandViReference[] {
  if (!Array.isArray(raw)) return [];
  const out: BrandViReference[] = [];
  for (const item of raw.slice(0, BRAND_VI_SKETCH_MAX)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl.trim() : "";
    if (!/^https?:\/\//.test(ossUrl)) continue;
    out.push({
      id: typeof r.id === "string" ? r.id : `ref-${out.length + 1}`,
      label: typeof r.label === "string" ? r.label.slice(0, 40) : `参考图${out.length + 1}`,
      role: "reference",
      ossUrl,
    });
  }
  return out;
}

export function sanitizeBrandViChatMessages(raw: unknown): BrandViChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: BrandViChatMessage[] = [];
  for (const item of raw.slice(-80)) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content : "";
    const text = content.trim();
    if (!text || text.length > 24000) continue;
    out.push({
      id: typeof m.id === "string" ? m.id : `${role}-${out.length}`,
      role,
      content: text,
      createdAt:
        typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
      refIds: Array.isArray(m.refIds)
        ? m.refIds.filter((x): x is string => typeof x === "string")
        : undefined,
    });
  }
  return out;
}

/** 本步是否已全部产出 */
export function isBrandViStepReady(state: BrandViStepState | undefined): boolean {
  if (!state) return false;
  if (state.outputs.length > 0) return state.outputs.every((o) => Boolean(o.imageUrl));
  return state.slots.length > 0 && state.slots.every((s) => Boolean(s.imageUrl));
}

export type BrandViRatio = EcomImageRatio;
