import {
  IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES,
  normalizeToOfficialFlexibleFeatures,
} from "@/lib/ecom/ecom-ip-master-flexible-official";
import { z } from "zod";

export const IP_MASTER_TEMPLATE_SCHEMA_VERSION = 1;

const rigidFeatureSchema = z.object({
  featureName: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  weight: z.coerce.number().min(0.5).max(1),
});

const flexibleFeatureSchema = z.object({
  featureName: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
});

export const ipMasterImagePromptSchema = z.object({
  positive: z.string().min(1).max(8000),
  negative: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : v.slice(0, 4000))),
});

const ipMetaSchema = z.object({
  ipId: z.string().min(1).max(120),
  ipName: z.string().min(1).max(120),
  version: z.string().min(1).max(20),
  createTime: z.string().min(1).max(40),
  baseImageUrl: z.string().max(2048).optional(),
  styleSummary: z.string().max(500).optional(),
});

export const ipMasterTemplateSchema = z.object({
  schemaVersion: z.number().optional(),
  ipMeta: ipMetaSchema,
  rigidFeatures: z.array(rigidFeatureSchema).min(1).max(24),
  flexibleFeatures: z
    .array(flexibleFeatureSchema)
    .length(IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES.length)
    .refine(
      (arr) =>
        arr.every(
          (row, i) => row.featureName === IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES[i],
        ),
      { message: "flexibleFeatures 须为官方 6 项且顺序固定" },
    ),
  softConstraint: z.string().max(2000),
  exceptionRule: z.string().max(2000).optional(),
  characterSummary: z.string().max(2000).optional(),
  pendingItems: z.array(z.string().max(200)).optional(),
  imagePrompt: ipMasterImagePromptSchema.optional(),
});

export type IpMasterTemplate = z.infer<typeof ipMasterTemplateSchema>;
export type IpMasterImagePrompt = z.infer<typeof ipMasterImagePromptSchema>;

export type IpMasterRegenerateTarget = "both" | "imagePrompt" | "structured";
export type IpMasterRigidFeature = z.infer<typeof rigidFeatureSchema>;
export type IpMasterFlexibleFeature = z.infer<typeof flexibleFeatureSchema>;

export function parseIpMasterTemplateJson(input: unknown): IpMasterTemplate | null {
  if (!input || typeof input !== "object") return null;
  const raw = { ...(input as Record<string, unknown>) };
  raw.flexibleFeatures = normalizeToOfficialFlexibleFeatures(raw.flexibleFeatures);
  const parsed = ipMasterTemplateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** 入库 / 母版库导入：须有条目 JSON + 项目基准图 */
export function isIpMasterTemplateLibraryReady(opts: {
  template: IpMasterTemplate | null;
  hasBenchmarkImage: boolean;
}): boolean {
  if (!opts.hasBenchmarkImage || !opts.template) return false;
  if (!opts.template.imagePrompt?.positive?.trim()) return false;
  return (
    opts.template.rigidFeatures.length > 0 &&
    opts.template.flexibleFeatures.length === IP_MASTER_OFFICIAL_FLEXIBLE_FEATURE_NAMES.length
  );
}

export function extractJsonObjectFromLlmText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型未返回有效 JSON");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampWeight(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw.trim()) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return 0.85;
  return Math.min(1, Math.max(0.5, n));
}

function normalizeFeatureName(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (s || fallback).slice(0, 80);
}

function normalizeDescription(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (s || fallback).slice(0, 2000);
}

function normalizeRigidFeatures(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => isRecord(item))
    .map((item, i) => ({
      featureName: normalizeFeatureName(item.featureName, `刚性特征${i + 1}`),
      description: normalizeDescription(item.description, "待校对"),
      weight: clampWeight(item.weight),
    }))
    .filter((f) => f.description.length > 0);
}

function normalizeImagePromptBlock(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;
  const positive =
    typeof raw.positive === "string"
      ? raw.positive.trim()
      : typeof raw.positivePrompt === "string"
        ? raw.positivePrompt.trim()
        : "";
  if (!positive) return undefined;
  const negativeRaw =
    typeof raw.negative === "string"
      ? raw.negative
      : typeof raw.negativePrompt === "string"
        ? raw.negativePrompt
        : undefined;
  const out: Record<string, unknown> = { positive: positive.slice(0, 8000) };
  if (negativeRaw?.trim()) out.negative = negativeRaw.trim().slice(0, 4000);
  return out;
}

/** 将常见 LLM 变体（扁平结构、字符串 weight、imagePrompt 嵌套等）整理为 llmDraftSchema 形状 */
export function normalizeIpMasterLlmDraft(
  raw: unknown,
  opts?: { projectId?: string; defaultIpName?: string },
): unknown {
  if (!isRecord(raw)) return raw;

  let imagePrompt = normalizeImagePromptBlock(raw.imagePrompt);
  let structured: Record<string, unknown>;

  if (isRecord(raw.structuredTemplate)) {
    structured = { ...raw.structuredTemplate };
  } else if (raw.rigidFeatures != null || raw.ipMeta != null || raw.flexibleFeatures != null) {
    structured = { ...raw };
    delete structured.imagePrompt;
    delete structured.structuredTemplate;
  } else {
    return raw;
  }

  if (!imagePrompt) {
    imagePrompt = normalizeImagePromptBlock(structured.imagePrompt);
    if (imagePrompt) delete structured.imagePrompt;
  }

  if (isRecord(structured.ipMeta)) {
    const meta = { ...structured.ipMeta };
    const ipId = typeof meta.ipId === "string" ? meta.ipId.trim() : "";
    if (!ipId && opts?.projectId) meta.ipId = opts.projectId;
    const ipName = typeof meta.ipName === "string" ? meta.ipName.trim() : "";
    if (!ipName && opts?.defaultIpName) meta.ipName = opts.defaultIpName.slice(0, 120);
    if (typeof meta.version !== "string" || !meta.version.trim()) meta.version = "V0.1";
    if (typeof meta.createTime !== "string" || !meta.createTime.trim()) {
      meta.createTime = new Date().toISOString().slice(0, 10);
    }
    if (meta.baseImageUrl === null) delete meta.baseImageUrl;
    if (typeof meta.styleSummary === "string") {
      meta.styleSummary = meta.styleSummary.slice(0, 500);
    }
    structured.ipMeta = meta;
  }

  let rigid = normalizeRigidFeatures(structured.rigidFeatures);
  if (rigid.length === 0) {
    rigid = [
      {
        featureName: "核心识别",
        description: "请根据大白话描述校对刚性锚点",
        weight: 0.9,
      },
    ];
  }
  structured.rigidFeatures = rigid;
  structured.flexibleFeatures = normalizeToOfficialFlexibleFeatures(
    structured.flexibleFeatures,
  );

  if (typeof structured.softConstraint !== "string") {
    structured.softConstraint = String(structured.softConstraint ?? "").slice(0, 2000);
  }
  if (structured.exceptionRule === null) delete structured.exceptionRule;
  if (structured.characterSummary === null) delete structured.characterSummary;
  if (structured.pendingItems === null) delete structured.pendingItems;
  if (!structured.schemaVersion) structured.schemaVersion = IP_MASTER_TEMPLATE_SCHEMA_VERSION;

  if (!imagePrompt) {
    imagePrompt = {
      positive: "泡泡玛特潮玩Q版角色标准正面基准立绘，纯白背景，平视正面，中立站姿，高清，单角色居中",
    };
  }

  return { imagePrompt, structuredTemplate: structured };
}

export function formatIpMasterDraftParseError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "模型返回的 JSON 不符合草稿 schema，请重试或手动校对";
  const path = first.path.length ? first.path.join(".") : "根对象";
  return `模型 JSON 校验失败（${path}：${first.message}）。请重试或在校对页手动填写。`;
}
