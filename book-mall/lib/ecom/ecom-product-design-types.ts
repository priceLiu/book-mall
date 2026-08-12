import { z } from "zod";

import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

export const ECOM_PRODUCT_DESIGN_MODULE = "product-creation";

/** 出图沿用既有资产 module，保证「我的资产」分组与计价行不变 */
export const ECOM_MAIN_IMAGE_MODULE = "main-image";
export const ECOM_DETAIL_PAGE_MODULE = "detail-page";

export const ECOM_MAIN_IMAGE_TOOL_KEY = "ecom-toolkit__main-image";
export const ECOM_MAIN_IMAGE_ACTION = "generate";
export const ECOM_DETAIL_PAGE_TOOL_KEY = "ecom-toolkit__detail-page";
export const ECOM_DETAIL_PAGE_ACTION = "panel";
export const ECOM_DETAIL_COPY_ACTION = "copy";

export type ProductDesignChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ProductDesignReferenceRole =
  | "product"
  | "main-style"
  | "detail-style"
  | "scene"
  | "model"
  | "other";

export type ProductDesignReference = {
  id: string;
  label: string;
  role: ProductDesignReferenceRole;
  ossUrl: string;
};

export type ProductDesignVisualBriefEntry = {
  summary: string;
  derivedPrompt: string;
  productTraits?: string;
  styleTraits?: string;
  modelKey: string;
  analyzedAt: string;
  refFingerprint?: string;
};

const visualBriefEntrySchema = z.object({
  summary: z.string().default(""),
  derivedPrompt: z.string().default(""),
  productTraits: z.string().optional(),
  styleTraits: z.string().optional(),
  modelKey: z.string().default(""),
  analyzedAt: z.string().default(""),
  refFingerprint: z.string().optional(),
});

const ratioSchema = z.enum(["1:1", "3:4", "4:5", "16:9"]);

const mainImageLayersSchema = z.object({
  topHint: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  delivery: z.string().optional(),
  footer: z.string().optional(),
});

export const productDesignSchema = z.object({
  analysis: z
    .object({
      platformNotes: z.string().default(""),
      surfacePainPoints: z.array(z.string()).default([]),
      deepNeeds: z.array(z.string()).default([]),
      differentiators: z.array(z.string()).default([]),
      visualTone: z.string().default(""),
      forbiddenWords: z.array(z.string()).default([]),
    })
    .optional(),
  marketingPlans: z
    .array(
      z.object({
        no: z.number().int().positive(),
        name: z.string().min(1),
        angle: z.string().default(""),
        painPoint: z.string().default(""),
        outcome: z.string().default(""),
        mood: z.string().default(""),
      }),
    )
    .default([]),
  selectedPlanNo: z.number().int().positive().optional(),
  buyingReasons: z.array(z.string()).default([]),
  mainImages: z
    .array(
      z.object({
        index: z.number().int().positive(),
        purpose: z.string().default(""),
        layers: mainImageLayersSchema,
        emphasis: z
          .object({
            bold: z.array(z.string()).default([]),
            color: z.array(z.string()).default([]),
          })
          .default({ bold: [], color: [] }),
        ratio: ratioSchema.optional(),
        imageUrl: z.string().optional(),
        assetId: z.string().optional(),
        genPrompt: z.string().optional(),
      }),
    )
    .default([]),
  detailOutline: z
    .array(
      z.object({
        index: z.number().int().positive(),
        mission: z.string().default(""),
        doubtResolved: z.string().default(""),
        titleDirection: z.string().default(""),
        tag: z.enum(["emotion", "proof", "risk", "other"]).default("other"),
      }),
    )
    .default([]),
  detailPages: z
    .array(
      z.object({
        index: z.number().int().positive(),
        purpose: z.string().default(""),
        title: z.string().min(1),
        body: z.array(z.string()).default([]),
        keyInfo: z.string().optional(),
        closingLine: z.string().optional(),
        layoutHint: z.string().optional(),
        ratio: ratioSchema.optional(),
        imageUrl: z.string().optional(),
        assetId: z.string().optional(),
        genPrompt: z.string().optional(),
      }),
    )
    .default([]),
  visualBrief: z
    .object({
      main: visualBriefEntrySchema.optional(),
      detail: visualBriefEntrySchema.optional(),
    })
    .optional(),
});

export type ProductDesign = z.infer<typeof productDesignSchema>;
export type ProductDesignMainImage = ProductDesign["mainImages"][number];
export type ProductDesignDetailPage = ProductDesign["detailPages"][number];

export type ProductDesignSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
  visionModelKey?: string;
  mainImageCount?: number;
  detailPageCount?: number;
  mainImageRatio?: EcomImageRatio;
  detailPageRatio?: EcomImageRatio;
  mainImageGenMode?: "copy" | "reference-prompt";
  mainImageCustomPrompt?: string;
  detailPageGenMode?: "copy" | "reference-decompose";
};

export const PRODUCT_DESIGN_STEPS = [
  { key: "brief", label: "信息采集" },
  { key: "analysis", label: "平台拆解" },
  { key: "marketing", label: "营销方案" },
  { key: "reasons", label: "购买理由" },
  { key: "main-copy", label: "主图文案" },
  { key: "main-image", label: "主图出图" },
  { key: "detail-outline", label: "详情架构" },
  { key: "detail-copy", label: "分屏文案" },
  { key: "detail-image", label: "详情出图" },
] as const;

export type ProductDesignStepKey = (typeof PRODUCT_DESIGN_STEPS)[number]["key"];

export function emptyProductDesign(): ProductDesign {
  return productDesignSchema.parse({});
}

export function parseProductDesign(input: unknown): ProductDesign | null {
  const result = productDesignSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function sanitizeProductDesignChatMessages(
  raw: unknown,
): ProductDesignChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductDesignChatMessage[] = [];
  for (const item of raw.slice(-80)) {
    if (!item || typeof item !== "object") continue;
    const { id, role, content, createdAt } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim();
    if (!text || text.length > 24000) continue;
    out.push({
      id: typeof id === "string" ? id : `${role}-${out.length}`,
      role,
      content: text,
      createdAt: typeof createdAt === "string" ? createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function sanitizeProductDesignReferences(raw: unknown): ProductDesignReference[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductDesignReference[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const ossUrl = typeof row.ossUrl === "string" ? row.ossUrl.trim() : "";
    if (!/^https?:\/\//.test(ossUrl)) continue;
    const roleRaw = typeof row.role === "string" ? row.role : "other";
    const role: ProductDesignReferenceRole =
      roleRaw === "product" ||
      roleRaw === "main-style" ||
      roleRaw === "detail-style" ||
      roleRaw === "scene" ||
      roleRaw === "model"
        ? roleRaw
        : "other";
    out.push({
      id: typeof row.id === "string" ? row.id : `ref-${out.length}`,
      label: typeof row.label === "string" ? row.label.slice(0, 40) : "参考图",
      role,
      ossUrl,
    });
  }
  return out;
}

function normalizeDesignPatch(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  if (Array.isArray(out.mainImages)) {
    out.mainImages = out.mainImages.map((item, i) => {
      if (!item || typeof item !== "object") return item;
      const row = item as Record<string, unknown>;
      const layersRaw =
        row.layers && typeof row.layers === "object"
          ? (row.layers as Record<string, unknown>)
          : {};
      const index =
        typeof row.index === "number" && row.index > 0 ? row.index : i + 1;
      const titleCandidate =
        layersRaw.title ?? row.title ?? row.mainTitle ?? layersRaw.mainTitle;
      const title = String(titleCandidate ?? "").trim() || `主图 ${index}`;
      return {
        ...row,
        index,
        purpose: String(row.purpose ?? "").trim() || title,
        layers: {
          topHint:
            layersRaw.topHint != null ? String(layersRaw.topHint) : undefined,
          title,
          subtitle:
            layersRaw.subtitle != null ? String(layersRaw.subtitle) : undefined,
          bullets: Array.isArray(layersRaw.bullets)
            ? layersRaw.bullets.map(String).filter(Boolean)
            : [],
          delivery:
            layersRaw.delivery != null ? String(layersRaw.delivery) : undefined,
          footer: layersRaw.footer != null ? String(layersRaw.footer) : undefined,
        },
        emphasis:
          row.emphasis && typeof row.emphasis === "object"
            ? row.emphasis
            : { bold: [], color: [] },
      };
    });
  }

  if (Array.isArray(out.detailPages)) {
    out.detailPages = out.detailPages.map((item, i) => {
      if (!item || typeof item !== "object") return item;
      const row = item as Record<string, unknown>;
      const index =
        typeof row.index === "number" && row.index > 0 ? row.index : i + 1;
      const title = String(row.title ?? row.mainTitle ?? `第 ${index} 屏`).trim();
      return {
        ...row,
        index,
        title: title || `第 ${index} 屏`,
        purpose: String(row.purpose ?? "").trim(),
        body: Array.isArray(row.body)
          ? row.body.map(String).filter(Boolean)
          : typeof row.body === "string"
            ? row.body
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      };
    });
  }

  return out;
}

/** 从助手回复里抽出 ```product-design``` / ```json``` 交付块，容忍前后自然语言 */
export function extractProductDesignJson(text: string): Partial<ProductDesign> | null {
  const trimmed = text.trim();
  const productDesignFenced = [
    ...trimmed.matchAll(/```product-design\s*([\s\S]*?)```/gi),
  ].map((m) => m[1]?.trim());
  const unclosedFence = trimmed.match(/```product-design\s*([\s\S]*)$/i)?.[1]?.trim();
  const jsonFenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) =>
    m[1]?.trim(),
  );
  const unclosedJson = trimmed.match(/```json\s*([\s\S]*)$/i)?.[1]?.trim();
  const candidates = [
    ...productDesignFenced,
    unclosedFence,
    ...jsonFenced,
    unclosedJson,
    trimmed,
  ].filter(Boolean) as string[];
  for (const candidate of candidates.reverse()) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      const normalized = normalizeDesignPatch(parsed);
      const result = productDesignSchema.partial().safeParse(normalized);
      if (result.success && Object.keys(result.data).length > 0) {
        return result.data;
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** 增量合并：助手每步只回传本步字段，不覆盖已生成的图片 URL */
export function mergeProductDesign(
  prev: ProductDesign | null,
  patch: Partial<ProductDesign>,
): ProductDesign {
  const base = prev ?? emptyProductDesign();
  const next: ProductDesign = { ...base, ...patch };

  if (patch.mainImages) {
    next.mainImages = patch.mainImages.map((item) => {
      const old = base.mainImages.find((m) => m.index === item.index);
      return {
        ...item,
        imageUrl: item.imageUrl ?? old?.imageUrl,
        assetId: item.assetId ?? old?.assetId,
        genPrompt: item.genPrompt ?? old?.genPrompt,
      };
    });
  }
  if (patch.detailPages) {
    next.detailPages = patch.detailPages.map((item) => {
      const old = base.detailPages.find((d) => d.index === item.index);
      return {
        ...item,
        imageUrl: item.imageUrl ?? old?.imageUrl,
        assetId: item.assetId ?? old?.assetId,
        genPrompt: item.genPrompt ?? old?.genPrompt,
      };
    });
  }
  if (patch.visualBrief === undefined && base.visualBrief) {
    next.visualBrief = base.visualBrief;
  }

  return productDesignSchema.parse(next);
}

const PRODUCT_REF_ROLES = new Set<ProductDesignReferenceRole>(["product"]);

export function hasProductDesignProductRef(
  references: ProductDesignReference[],
): boolean {
  return references.some((r) => PRODUCT_REF_ROLES.has(r.role));
}

export function filterProductDesignReferencesByRole(
  references: ProductDesignReference[],
  roles: ProductDesignReferenceRole[],
): ProductDesignReference[] {
  const set = new Set(roles);
  return references.filter((r) => set.has(r.role));
}

/** 参考图变更指纹，用于判断 visualBrief 是否过期 */
export function productDesignRefFingerprint(
  references: ProductDesignReference[],
  roles: ProductDesignReferenceRole[],
): string {
  return filterProductDesignReferencesByRole(references, roles)
    .map((r) => `${r.id}:${r.ossUrl}`)
    .sort()
    .join("|");
}
