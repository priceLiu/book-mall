import { z } from "zod";

import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  HAND_CRAFT_STEP_IDS,
  type HandCraftStepId,
} from "@/lib/ecom/ecom-hand-craft-steps";

export const ECOM_HAND_CRAFT_TOOL_KEY = "ecom-toolkit__hand-craft";
export const ECOM_HAND_CRAFT_MODULE = "hand-craft";
export const ECOM_HAND_CRAFT_GENERATE_ACTION = "generate";
export const ECOM_HAND_CRAFT_COMPOSE_ACTION = "compose";
export const ECOM_HAND_CRAFT_SKETCH_GENERATE_ACTION = "sketch-generate";

/** AI 生成线稿默认模型（通义万相 2.7 多图参考） */
export const HAND_CRAFT_SKETCH_GEN_MODEL = "wan2.7-image";

/** 生成线稿弹窗默认 Prompt（用户可改） */
export const HAND_CRAFT_SKETCH_GEN_DEFAULT_PROMPT =
  "手绘铅笔画卷发女孩 基于这个IP草图，保持所有细节不变，生成泡泡玛特风格，3D卡通角色，高清可爱，明亮干净的色调，柔和光影过渡塑造简洁现代的视觉氛围，手办，纯白色背景";

/** 线稿最多 3 张（正面 + 补充角度） */
export const HAND_CRAFT_SKETCH_MAX = 3;

export type HandCraftChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  refIds?: string[];
};

/** 只有线稿一种参考图角色：其余步骤的参考图来自已定稿成图 */
export type HandCraftReference = {
  id: string;
  label: string;
  role: "sketch";
  ossUrl: string;
};

export type HandCraftSlot = {
  index: number;
  title: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  /** 用户手改过 Prompt：重置本步时保留 */
  promptEdited?: boolean;
};

export type HandCraftComposeOutput = {
  index: number;
  title: string;
  imageUrl: string;
  assetId?: string;
};

export type HandCraftStepState = {
  stepId: HandCraftStepId;
  status: "pending" | "generating" | "ready";
  slots: HandCraftSlot[];
  /** compose 步的拼版产出 */
  outputs: HandCraftComposeOutput[];
  updatedAt?: string;
};

export type HandCraftPlan = {
  steps: Partial<Record<HandCraftStepId, HandCraftStepState>>;
};

export type HandCraftSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  /** 批量出图并发（1–5） */
  imageGenConcurrency?: number;
};

export type HandCraftMeta = {
  workflow?: {
    /** 当前进行到哪一步 */
    currentStepId?: HandCraftStepId;
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

export const handCraftStepStateSchema = z.object({
  stepId: z.enum(HAND_CRAFT_STEP_IDS),
  status: z.enum(["pending", "generating", "ready"]).default("pending"),
  slots: z.array(slotSchema).default([]),
  outputs: z.array(composeOutputSchema).default([]),
  updatedAt: z.string().optional(),
});

/**
 * 逐 key 解析：整体 z.record + enum key 在 zod 3 会把 steps 推成「全 key 必填」，
 * 与 Partial 语义不符，因此这里手动挑出合法步骤，坏数据丢弃而不是整份 plan 作废。
 */
export function parseHandCraftPlan(raw: unknown): HandCraftPlan {
  const steps: HandCraftPlan["steps"] = {};
  const rawSteps =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ((raw as Record<string, unknown>).steps as unknown)
      : null;
  if (rawSteps && typeof rawSteps === "object" && !Array.isArray(rawSteps)) {
    for (const [key, value] of Object.entries(rawSteps as Record<string, unknown>)) {
      if (!(HAND_CRAFT_STEP_IDS as readonly string[]).includes(key)) continue;
      const parsed = handCraftStepStateSchema.safeParse({ stepId: key, ...(value as object) });
      if (!parsed.success) continue;
      steps[key as HandCraftStepId] = parsed.data as HandCraftStepState;
    }
  }
  return { steps };
}

export function emptyHandCraftPlan(): HandCraftPlan {
  return { steps: {} };
}

export function sanitizeHandCraftReferences(raw: unknown): HandCraftReference[] {
  if (!Array.isArray(raw)) return [];
  const out: HandCraftReference[] = [];
  for (const item of raw.slice(0, HAND_CRAFT_SKETCH_MAX)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl.trim() : "";
    if (!/^https?:\/\//.test(ossUrl)) continue;
    out.push({
      id: typeof r.id === "string" ? r.id : `sketch-${out.length + 1}`,
      label: typeof r.label === "string" ? r.label.slice(0, 40) : `线稿${out.length + 1}`,
      role: "sketch",
      ossUrl,
    });
  }
  return out;
}

export function sanitizeHandCraftChatMessages(raw: unknown): HandCraftChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HandCraftChatMessage[] = [];
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
export function isHandCraftStepReady(state: HandCraftStepState | undefined): boolean {
  if (!state) return false;
  if (state.outputs.length > 0) return state.outputs.every((o) => Boolean(o.imageUrl));
  return state.slots.length > 0 && state.slots.every((s) => Boolean(s.imageUrl));
}

export type HandCraftRatio = EcomImageRatio;
