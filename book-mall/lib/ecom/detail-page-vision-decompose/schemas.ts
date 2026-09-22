import { z } from "zod";

import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";

import { DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION } from "./constants";

export const DETAIL_PAGE_VISION_MODULE_IDS = OUTDOOR_JACKET_MODULES.map((m) => m.module_id);

export function maxSlotsForDetailPageModule(moduleId: string): number {
  return OUTDOOR_JACKET_MODULES.find((m) => m.module_id === moduleId)?.max_num ?? 1;
}

const VisualDetailSchema = z.object({
  model: z.string().optional(),
  garment: z.string().optional(),
  background: z.string().optional(),
  scene: z.string().optional(),
  lighting: z.string().optional(),
  pose: z.string().optional(),
  props: z.string().optional(),
  onImageText: z.string().optional(),
});

const DecomposeItemSchema = z.object({
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  layoutHint: z.string().optional(),
  referenceCopyHints: z.array(z.string()).optional(),
  visualDetail: VisualDetailSchema.optional(),
});

const DecomposeModuleSchema = z.object({
  module_id: z.string().min(1),
  detected: z.boolean(),
  coverageNote: z.string().optional(),
  sizeChartHint: z.string().optional(),
  items: z.array(DecomposeItemSchema),
});

export const DetailPageVisionDecomposeSchema = z.object({
  schemaVersion: z.string().optional(),
  categoryKey: z.string().optional(),
  referenceSummary: z.string().optional(),
  sharedVisualBrief: z.string().optional(),
  modules: z.array(DecomposeModuleSchema).length(DETAIL_PAGE_VISION_MODULE_IDS.length),
});

export type DetailPageVisionDecompose = z.infer<typeof DetailPageVisionDecomposeSchema>;
export type DetailPageVisionDecomposeItem = z.infer<typeof DecomposeItemSchema>;
export type DetailPageVisionDecomposeModule = z.infer<typeof DecomposeModuleSchema>;

export function assertDetailPageVisionModuleOrder(
  modules: DetailPageVisionDecompose["modules"],
): string | null {
  for (let i = 0; i < DETAIL_PAGE_VISION_MODULE_IDS.length; i++) {
    if (modules[i]?.module_id !== DETAIL_PAGE_VISION_MODULE_IDS[i]) {
      return `模块顺序或 id 不匹配：期望 ${DETAIL_PAGE_VISION_MODULE_IDS[i]}`;
    }
  }
  return null;
}

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return undefined;
}

function coerceReferenceCopyHints(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return undefined;
    const lines = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    return lines.length ? lines : [t];
  }
  return undefined;
}

function coerceVisualDetail(v: unknown): z.infer<typeof VisualDetailSchema> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of [
    "model",
    "garment",
    "background",
    "scene",
    "lighting",
    "pose",
    "props",
    "onImageText",
  ] as const) {
    const s = coerceOptionalString(o[key]);
    if (s) out[key] = s;
  }
  return Object.keys(out).length ? (out as z.infer<typeof VisualDetailSchema>) : undefined;
}

/** 视觉模型常见偏差：null 字段、缺 item_key、hints 写成字符串等 */
export function coerceDetailPageVisionDecomposeRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const root = raw as Record<string, unknown>;
  const modulesIn = Array.isArray(root.modules) ? root.modules : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of modulesIn) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.module_id ?? "").trim();
    if (id) byId.set(id, row);
  }

  const modules = DETAIL_PAGE_VISION_MODULE_IDS.map((module_id, modIndex) => {
    const src =
      byId.get(module_id) ??
      (modulesIn[modIndex] && typeof modulesIn[modIndex] === "object"
        ? (modulesIn[modIndex] as Record<string, unknown>)
        : { module_id, detected: false, items: [] });
    const detected = src.detected === true;
    const itemsIn = Array.isArray(src.items) ? src.items : [];
    const items = detected
      ? itemsIn.map((it, itemIndex) => {
          if (!it || typeof it !== "object") {
            return {
              item_key: `${module_id}__${itemIndex + 1}`,
              item_label: `画面 ${itemIndex + 1}`,
            };
          }
          const row = it as Record<string, unknown>;
          const item_key =
            coerceOptionalString(row.item_key) ?? `${module_id}__${itemIndex + 1}`;
          const item_label =
            coerceOptionalString(row.item_label) ??
            coerceOptionalString(row.layoutHint) ??
            `画面 ${itemIndex + 1}`;
          const out: Record<string, unknown> = {
            item_key,
            item_label,
          };
          const layoutHint = coerceOptionalString(row.layoutHint);
          if (layoutHint) out.layoutHint = layoutHint;
          const hints = coerceReferenceCopyHints(row.referenceCopyHints);
          if (hints) out.referenceCopyHints = hints;
          const visualDetail = coerceVisualDetail(row.visualDetail);
          if (visualDetail) out.visualDetail = visualDetail;
          return out;
        })
      : [];

    return {
      module_id,
      detected,
      coverageNote: coerceOptionalString(src.coverageNote),
      sizeChartHint: coerceOptionalString(src.sizeChartHint),
      items,
    };
  });

  return {
    ...root,
    modules,
  };
}

export function formatDetailPageVisionDecomposeValidationError(err: z.ZodError): string {
  const head = err.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`);
  const suffix = err.issues.length > 4 ? ` …共 ${err.issues.length} 项` : "";
  return `视觉拆解 JSON 校验失败（${head.join("；")}${suffix}）`;
}

export function normalizeDetailPageVisionDecompose(raw: unknown): DetailPageVisionDecompose {
  const coerced = coerceDetailPageVisionDecomposeRaw(raw);
  const parsed = DetailPageVisionDecomposeSchema.safeParse(coerced);
  if (!parsed.success) {
    throw new Error(formatDetailPageVisionDecomposeValidationError(parsed.error));
  }
  const data = parsed.data;
  if (
    data.schemaVersion &&
    data.schemaVersion !== DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 schemaVersion: ${data.schemaVersion}`);
  }
  const orderErr = assertDetailPageVisionModuleOrder(data.modules);
  if (orderErr) throw new Error(orderErr);
  return data;
}

/** 润色/落格子时按模块 max_num 取首批；完整拆解仍保存在 phaseA */
export function sliceDecomposeModuleForSlotBudget(
  mod: DetailPageVisionDecomposeModule,
): { module: DetailPageVisionDecomposeModule; truncated: number } {
  const limit = maxSlotsForDetailPageModule(mod.module_id);
  if (mod.items.length <= limit) {
    return { module: mod, truncated: 0 };
  }
  return {
    module: { ...mod, items: mod.items.slice(0, limit) },
    truncated: mod.items.length - limit,
  };
}

export function collectDecomposeTruncateWarnings(
  phaseA: DetailPageVisionDecompose,
): string[] {
  const warnings: string[] = [];
  for (const mod of phaseA.modules) {
    const limit = maxSlotsForDetailPageModule(mod.module_id);
    if (mod.items.length > limit) {
      warnings.push(
        `${mod.module_id} 拆解 ${mod.items.length} 条，首批润色/出图格子 ${limit} 条；其余保留在拆解结果，可手动新增点位`,
      );
    }
  }
  return warnings;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 从首个 `{` 起按括号深度截取完整 JSON 对象（避免 lastIndexOf 截断嵌套 JSON） */
export function extractFirstBalancedJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("大模型未返回有效 JSON");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  throw new Error("大模型未返回有效 JSON");
}

export function extractFenceJson(text: string, fenceName: string): unknown {
  const trimmed = text.trim();
  const bodies: string[] = [];
  const fenceRe = new RegExp("```" + escapeRegExp(fenceName) + "\\s*([\\s\\S]*?)```", "i");
  const fenceMatch = trimmed.match(fenceRe);
  if (fenceMatch?.[1]?.trim()) bodies.push(fenceMatch[1].trim());
  const jsonFence = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (jsonFence?.[1]?.trim()) bodies.push(jsonFence[1].trim());
  const anyFence = trimmed.match(/```[^\n`]*\n([\s\S]*?)```/);
  if (anyFence?.[1]?.trim()) bodies.push(anyFence[1].trim());
  bodies.push(trimmed);

  let lastErr: Error | null = null;
  for (const body of bodies) {
    try {
      const slice = extractFirstBalancedJsonObject(body);
      return JSON.parse(slice) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = new Error(
        msg.includes("JSON") ? msg : `大模型未返回有效 JSON：${msg.slice(0, 120)}`,
      );
    }
  }
  throw lastErr ?? new Error("大模型未返回有效 JSON");
}
