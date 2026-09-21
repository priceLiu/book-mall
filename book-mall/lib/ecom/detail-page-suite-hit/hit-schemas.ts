import { z } from "zod";

import { extractFenceJson } from "@/lib/ecom/detail-page-vision-decompose";
import {
  DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION,
  DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION,
} from "@/lib/ecom/detail-page-suite/types";

import {
  HIT_DEFAULT_LAYOUT,
  HIT_DEFAULT_TEXT_SLOT,
  HIT_LAYOUT_ALIASES,
  HIT_TYPE_ALIASES,
} from "./hit-template-defaults";

export { extractFenceJson };

export const HIT_COMPONENT_TYPES = [
  "full_banner",
  "main_product",
  "feature_card",
  "spec_table",
  "detail_closeup",
  "scene_image",
  "contrast",
  "after_sale",
  "other",
] as const;

export type HitComponentType = (typeof HIT_COMPONENT_TYPES)[number];

export const HIT_LAYOUTS = [
  "full_image",
  "image_text_top_bottom",
  "image_text_left_right",
  "text_only",
  "table",
] as const;

export type HitLayout = (typeof HIT_LAYOUTS)[number];

export const HIT_COMPONENT_LABELS: Record<HitComponentType, string> = {
  full_banner: "全屏首屏海报",
  main_product: "主视觉产品展示",
  feature_card: "核心卖点卡位",
  spec_table: "参数规格",
  detail_closeup: "产品细节特写",
  scene_image: "场景穿搭展示",
  contrast: "产品对比",
  after_sale: "售后保障",
  other: "自定义模块",
};

export const HIT_LAYOUT_LABELS: Record<HitLayout, string> = {
  full_image: "全屏通图",
  image_text_top_bottom: "上图下文",
  image_text_left_right: "左图右文",
  text_only: "纯文本标题",
  table: "表格布局",
};

export const HIT_REPEATABLE_TYPES = new Set<HitComponentType>([
  "feature_card",
  "detail_closeup",
  "scene_image",
]);

export function maxRepeatForType(type: HitComponentType): number {
  if (type === "feature_card") return 6;
  if (type === "detail_closeup" || type === "scene_image") return 8;
  return 4;
}

const HitTextSlotSchema = z.object({
  max_char: z.number().int().min(4).max(120).optional(),
  text_type: z.string().min(1).max(40).optional(),
});

const HitImageSlotSchema = z.object({
  composition: z.string().min(1).optional(),
  need_scene_bg: z.boolean().optional(),
});

/** LLM 常高估重复卡位数；先宽松接收，normalize 时按类型 clamp */
const HitComponentSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(HIT_COMPONENT_TYPES),
  layout: z.enum(HIT_LAYOUTS),
  repeat_count: z.number().int().min(1).max(99).optional(),
  user_editable_count: z.boolean().optional(),
  note: z.string().optional(),
  text_slot: HitTextSlotSchema.optional(),
  image_slot: HitImageSlotSchema.optional(),
});

const HitGlobalStyleSchema = z.object({
  scene_environment: z.string().optional(),
  scene_theme: z.string().optional(),
  light_style: z.string().optional(),
  color_tone: z.string().optional(),
  composition_style: z.string().optional(),
  picture_atmosphere: z.string().optional(),
  photo_style: z.string().optional(),
  prop_style: z.string().optional(),
  clarity_texture: z.string().optional(),
});

export const HitMarketInsightSchema = z.object({
  hot_selling_dimensions: z.array(z.string()).optional(),
  user_pain_points: z.array(z.string()).optional(),
  narrative_sequence: z.string().optional(),
  copy_style: z.string().optional(),
  module_copy_functions: z.array(z.string()).optional(),
});

export type HitGlobalStyle = z.infer<typeof HitGlobalStyleSchema>;
export type HitMarketInsight = z.infer<typeof HitMarketInsightSchema>;

const HitCopyParadigmSchema = z.object({
  pain_points: z.array(z.string()).optional(),
  narrative_order: z.array(z.string()).optional(),
  module_copy_roles: z.array(z.string()).optional(),
  tone: z.string().optional(),
});

export const HitTemplateSchema = z.object({
  schemaVersion: z.string().optional(),
  template_name: z.string().min(1),
  canvas_width: z.number().int().optional(),
  category_tag: z.array(z.string()).optional(),
  market_insight: HitMarketInsightSchema.optional(),
  global_style: HitGlobalStyleSchema.optional(),
  global_copy_style: z.string().optional(),
  copy_paradigm: HitCopyParadigmSchema.optional(),
  component_list: z.array(HitComponentSchema).min(1),
});

export type HitTemplate = z.infer<typeof HitTemplateSchema>;
export type HitComponent = HitTemplate["component_list"][number] & { id: string };

export type NormalizedHitTemplate = Omit<HitTemplate, "component_list" | "canvas_width"> & {
  schemaVersion: string;
  canvas_width: 750;
  component_list: HitComponent[];
};

function slugType(type: string, index: number): string {
  return `hit_${type}_${index + 1}`;
}

function clampRepeat(type: HitComponentType, raw: number | undefined): number {
  if (!HIT_REPEATABLE_TYPES.has(type)) return 1;
  const max = maxRepeatForType(type);
  const n = raw && Number.isFinite(raw) ? Math.round(raw) : 3;
  return Math.min(max, Math.max(1, n));
}

export function formatHitTemplateValidationError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "爆款范式 JSON 校验失败";
  const path = first.path.length ? first.path.join(".") : "root";
  return `爆款范式校验失败：${path} ${first.message}`;
}

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function coerceInt(v: unknown, fallback?: number): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return fallback;
}

function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return undefined;
}

function coerceHitComponentType(v: unknown): HitComponentType {
  const raw = coerceOptionalString(v) ?? "";
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if ((HIT_COMPONENT_TYPES as readonly string[]).includes(key)) {
    return key as HitComponentType;
  }
  const alias = HIT_TYPE_ALIASES[key] ?? HIT_TYPE_ALIASES[raw];
  if (alias) return alias;
  return "other";
}

function coerceHitLayout(v: unknown, type: HitComponentType): HitLayout {
  const raw = coerceOptionalString(v) ?? "";
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if ((HIT_LAYOUTS as readonly string[]).includes(key)) {
    return key as HitLayout;
  }
  const alias = HIT_LAYOUT_ALIASES[key] ?? HIT_LAYOUT_ALIASES[raw];
  if (alias && (HIT_LAYOUTS as readonly string[]).includes(alias)) {
    return alias as HitLayout;
  }
  return HIT_DEFAULT_LAYOUT[type] as HitLayout;
}

function coerceTextSlot(
  v: unknown,
  type: HitComponentType,
): { max_char: number; text_type: string } {
  const defaults = HIT_DEFAULT_TEXT_SLOT[type];
  if (!v || typeof v !== "object") return { ...defaults };
  const o = v as Record<string, unknown>;
  const maxRaw = coerceInt(o.max_char, defaults.max_char) ?? defaults.max_char;
  const max_char = Math.min(120, Math.max(4, maxRaw));
  const text_type = coerceOptionalString(o.text_type) ?? defaults.text_type;
  return { max_char, text_type };
}

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[\n,，;；]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function coerceGlobalStyle(v: unknown): HitGlobalStyle | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const scene_environment =
    coerceOptionalString(o.scene_environment) ??
    coerceOptionalString(o.scene_theme) ??
    coerceOptionalString(o["场景环境"]);
  const light_style =
    coerceOptionalString(o.light_style) ?? coerceOptionalString(o["光影类型"]);
  const color_tone =
    coerceOptionalString(o.color_tone) ?? coerceOptionalString(o["整体色调"]);
  const composition_style =
    coerceOptionalString(o.composition_style) ?? coerceOptionalString(o["构图方式"]);
  const picture_atmosphere =
    coerceOptionalString(o.picture_atmosphere) ??
    coerceOptionalString(o.photo_style) ??
    coerceOptionalString(o["画面氛围"]);
  const prop_style =
    coerceOptionalString(o.prop_style) ?? coerceOptionalString(o["道具风格"]);
  const clarity_texture =
    coerceOptionalString(o.clarity_texture) ?? coerceOptionalString(o["清晰度质感"]);

  const out: HitGlobalStyle = {
    ...(scene_environment ? { scene_environment } : {}),
    ...(light_style ? { light_style } : {}),
    ...(color_tone ? { color_tone } : {}),
    ...(composition_style ? { composition_style } : {}),
    ...(picture_atmosphere ? { picture_atmosphere } : {}),
    ...(prop_style ? { prop_style } : {}),
    ...(clarity_texture ? { clarity_texture } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function coerceMarketInsight(v: unknown): HitMarketInsight | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const hot_selling_dimensions = coerceStringArray(
    o.hot_selling_dimensions ?? o.hotSellingDimensions ?? o["卖点维度"],
  );
  const user_pain_points = coerceStringArray(
    o.user_pain_points ?? o.userPainPoints ?? o.pain_points ?? o["用户痛点"],
  );
  const narrative_sequence =
    coerceOptionalString(o.narrative_sequence) ??
    coerceOptionalString(o.narrativeSequence) ??
    (Array.isArray(o.narrative_order)
      ? o.narrative_order.map((x) => String(x).trim()).filter(Boolean).join(" → ")
      : undefined);
  const copy_style =
    coerceOptionalString(o.copy_style) ??
    coerceOptionalString(o.copyStyle) ??
    coerceOptionalString(o.tone);
  const module_copy_functions = coerceStringArray(
    o.module_copy_functions ?? o.module_copy_roles ?? o["核心文案功能"],
  );

  const out: HitMarketInsight = {
    ...(hot_selling_dimensions.length ? { hot_selling_dimensions } : {}),
    ...(user_pain_points.length ? { user_pain_points } : {}),
    ...(narrative_sequence ? { narrative_sequence } : {}),
    ...(copy_style ? { copy_style } : {}),
    ...(module_copy_functions.length ? { module_copy_functions } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function mergeMarketInsightFromLegacy(
  insight: HitMarketInsight | undefined,
  copyParadigm: z.infer<typeof HitCopyParadigmSchema> | undefined,
  globalCopyStyle: string | undefined,
): HitMarketInsight | undefined {
  const merged: HitMarketInsight = { ...(insight ?? {}) };
  if (copyParadigm) {
    if (!merged.user_pain_points?.length && copyParadigm.pain_points?.length) {
      merged.user_pain_points = copyParadigm.pain_points;
    }
    if (!merged.narrative_sequence && copyParadigm.narrative_order?.length) {
      merged.narrative_sequence = copyParadigm.narrative_order.join(" → ");
    }
    if (!merged.module_copy_functions?.length && copyParadigm.module_copy_roles?.length) {
      merged.module_copy_functions = copyParadigm.module_copy_roles;
    }
    if (!merged.copy_style && copyParadigm.tone) {
      merged.copy_style = copyParadigm.tone;
    }
  }
  if (!merged.copy_style && globalCopyStyle) {
    merged.copy_style = globalCopyStyle;
  }
  return Object.keys(merged).length ? merged : insight;
}

function syncCopyParadigmFromInsight(
  insight: HitMarketInsight | undefined,
): z.infer<typeof HitCopyParadigmSchema> | undefined {
  if (!insight) return undefined;
  const pain_points = insight.user_pain_points;
  const narrative_order = insight.narrative_sequence
    ? insight.narrative_sequence.split(/\s*[→>]\s*/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  const module_copy_roles = insight.module_copy_functions;
  const tone = insight.copy_style;
  const out = {
    ...(pain_points?.length ? { pain_points } : {}),
    ...(narrative_order?.length ? { narrative_order } : {}),
    ...(module_copy_roles?.length ? { module_copy_roles } : {}),
    ...(tone ? { tone } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function coerceImageSlot(
  v: unknown,
  type: HitComponentType,
): { composition?: string; need_scene_bg?: boolean } {
  const needDefault =
    type === "scene_image" || type === "full_banner" || type === "main_product";
  if (!v || typeof v !== "object") {
    return needDefault ? { need_scene_bg: true, composition: "半身" } : {};
  }
  const o = v as Record<string, unknown>;
  const composition = coerceOptionalString(o.composition);
  const need_scene_bg = coerceBool(o.need_scene_bg) ?? needDefault;
  return {
    ...(composition ? { composition } : {}),
    need_scene_bg,
  };
}

/** Vision/编辑入参容错：类型别名、数字字符串、缺省插槽等 */
export function coerceHitTemplateRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const listIn = o.component_list;
  const component_list = Array.isArray(listIn)
    ? listIn
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const c = item as Record<string, unknown>;
          const type = coerceHitComponentType(c.type);
          const layout = coerceHitLayout(c.layout, type);
          const repeat_count = coerceInt(c.repeat_count);
          return {
            ...(coerceOptionalString(c.id) ? { id: coerceOptionalString(c.id) } : {}),
            type,
            layout,
            ...(repeat_count != null ? { repeat_count } : {}),
            ...(coerceBool(c.user_editable_count) != null
              ? { user_editable_count: coerceBool(c.user_editable_count) }
              : {}),
            ...(coerceOptionalString(c.note) ? { note: coerceOptionalString(c.note) } : {}),
            text_slot: coerceTextSlot(c.text_slot, type),
            image_slot: coerceImageSlot(c.image_slot, type),
          };
        })
        .filter(Boolean)
    : [];

  const category_tag = Array.isArray(o.category_tag)
    ? o.category_tag.map((x) => String(x).trim()).filter(Boolean)
    : coerceOptionalString(o.category_tag)
      ? [coerceOptionalString(o.category_tag)!]
      : undefined;

  const copy_paradigm =
    o.copy_paradigm && typeof o.copy_paradigm === "object"
      ? (o.copy_paradigm as z.infer<typeof HitCopyParadigmSchema>)
      : undefined;
  const market_insight = mergeMarketInsightFromLegacy(
    coerceMarketInsight(o.market_insight),
    copy_paradigm,
    coerceOptionalString(o.global_copy_style),
  );
  const global_style = coerceGlobalStyle(o.global_style);

  return {
    ...o,
    template_name:
      coerceOptionalString(o.template_name) ??
      coerceOptionalString(o.templateName) ??
      "爆款详情范式",
    schemaVersion:
      coerceOptionalString(o.schemaVersion) ?? DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION,
    canvas_width: coerceInt(o.canvas_width, 750),
    ...(category_tag?.length ? { category_tag } : {}),
    ...(market_insight ? { market_insight } : {}),
    ...(global_style ? { global_style } : {}),
    global_copy_style: coerceOptionalString(o.global_copy_style),
    ...(copy_paradigm ? { copy_paradigm } : {}),
    component_list,
  };
}

export type NormalizeHitTemplateResult = {
  template: NormalizedHitTemplate;
  warnings: string[];
};

export function normalizeHitTemplateDetailed(raw: unknown): NormalizeHitTemplateResult {
  const coerced = coerceHitTemplateRaw(raw);
  const parsed = HitTemplateSchema.safeParse(coerced);
  if (!parsed.success) {
    throw new Error(formatHitTemplateValidationError(parsed.error));
  }
  if (
    parsed.data.schemaVersion &&
    parsed.data.schemaVersion !== DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 hit schemaVersion: ${parsed.data.schemaVersion}`);
  }

  const warnings: string[] = [];
  const used = new Set<string>();
  const component_list = parsed.data.component_list.map((c, i) => {
    const base = (c.id?.trim() || slugType(c.type, i)).slice(0, 48);
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}_${n}`;
      n += 1;
    }
    used.add(id);

    const rawRepeat = c.repeat_count;
    const repeat_count = clampRepeat(c.type, c.repeat_count);
    if (rawRepeat != null && rawRepeat !== repeat_count) {
      warnings.push(
        `${HIT_COMPONENT_LABELS[c.type]} repeat_count ${rawRepeat} 已截断为 ${repeat_count}`,
      );
    }
    if (!HIT_REPEATABLE_TYPES.has(c.type) && repeat_count > 1) {
      warnings.push(`${HIT_COMPONENT_LABELS[c.type]} 不可重复，已改为 1 张`);
    }

    const layoutDefault = HIT_DEFAULT_LAYOUT[c.type] as HitLayout;
    let layout = c.layout;
    if (c.type === "spec_table" && layout !== "table" && layout !== "text_only") {
      layout = "table";
      warnings.push("参数规格模块排版已规范为 table");
    }

    const userEditable = c.user_editable_count ?? HIT_REPEATABLE_TYPES.has(c.type);
    const text_slot = coerceTextSlot(c.text_slot, c.type);
    const image_slot = coerceImageSlot(c.image_slot, c.type);

    return {
      ...c,
      id,
      layout: layout ?? layoutDefault,
      repeat_count: HIT_REPEATABLE_TYPES.has(c.type) ? repeat_count : 1,
      user_editable_count: userEditable,
      note: c.note?.trim() || undefined,
      text_slot,
      image_slot,
    };
  });

  if (component_list.length > 24) {
    warnings.push("component_list 超过 24 条，建议合并同类卡位");
  }

  const market_insight = mergeMarketInsightFromLegacy(
    parsed.data.market_insight,
    parsed.data.copy_paradigm,
    parsed.data.global_copy_style,
  );
  const copy_paradigm =
    syncCopyParadigmFromInsight(market_insight) ?? parsed.data.copy_paradigm;
  const global_copy_style =
    parsed.data.global_copy_style?.trim() ||
    market_insight?.copy_style?.trim() ||
    undefined;
  let global_style = parsed.data.global_style;
  if (global_style?.scene_theme && !global_style.scene_environment) {
    global_style = {
      ...global_style,
      scene_environment: global_style.scene_theme,
    };
  }
  if (global_style?.photo_style && !global_style.picture_atmosphere) {
    global_style = {
      ...global_style,
      picture_atmosphere: global_style.photo_style,
    };
  }

  const uniqWarnings = [...new Set(warnings)];
  return {
    template: {
      ...parsed.data,
      schemaVersion: DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION,
      canvas_width: 750,
      ...(market_insight ? { market_insight } : {}),
      ...(global_style ? { global_style } : {}),
      ...(global_copy_style ? { global_copy_style } : {}),
      ...(copy_paradigm ? { copy_paradigm } : {}),
      component_list,
    },
    warnings: uniqWarnings,
  };
}

export function normalizeHitTemplate(raw: unknown): NormalizedHitTemplate {
  return normalizeHitTemplateDetailed(raw).template;
}

export function formatHitTemplateWarnings(warnings: string[]): string | undefined {
  if (warnings.length === 0) return undefined;
  return `${warnings.slice(0, 3).join("；")}${warnings.length > 3 ? "…" : ""}`;
}

const HitRewriteItemSchema = z.object({
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  slot_copy: z.string().optional(),
  positive_prompt: z.string().min(8),
  negative_prompt: z.string().optional(),
});

const HitRewriteComponentSchema = z.object({
  component_id: z.string().min(1),
  items: z.array(HitRewriteItemSchema).min(1),
});

export const HitRewriteSchema = z.object({
  schemaVersion: z.string().optional(),
  components: z.array(HitRewriteComponentSchema).min(1),
});

export type HitRewrite = z.infer<typeof HitRewriteSchema>;

function coerceHitRewriteRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const comps = Array.isArray(o.components) ? o.components : [];
  return {
    ...o,
    schemaVersion:
      coerceOptionalString(o.schemaVersion) ?? DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION,
    components: comps.map((item) => {
      if (!item || typeof item !== "object") return item;
      const c = item as Record<string, unknown>;
      const itemsIn = Array.isArray(c.items) ? c.items : [];
      return {
        component_id: coerceOptionalString(c.component_id) ?? "",
        items: itemsIn.map((it, idx) => {
          if (!it || typeof it !== "object") return it;
          const row = it as Record<string, unknown>;
          return {
            item_key: coerceOptionalString(row.item_key) ?? `item_${idx + 1}`,
            item_label: coerceOptionalString(row.item_label) ?? `卡位 ${idx + 1}`,
            slot_copy: coerceOptionalString(row.slot_copy),
            positive_prompt: coerceOptionalString(row.positive_prompt) ?? "",
            negative_prompt: coerceOptionalString(row.negative_prompt),
          };
        }),
      };
    }),
  };
}

export function normalizeHitRewrite(
  raw: unknown,
  expected: Array<{ id: string; repeat_count: number }>,
): HitRewrite {
  const parsed = HitRewriteSchema.parse(coerceHitRewriteRaw(raw));
  if (
    parsed.schemaVersion &&
    parsed.schemaVersion !== DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 rewrite schemaVersion: ${parsed.schemaVersion}`);
  }
  const expectedById = new Map(expected.map((e) => [e.id, e.repeat_count]));
  const seen = new Set<string>();
  const components = [];
  for (const id of expected.map((e) => e.id)) {
    const want = expectedById.get(id) ?? 1;
    const c = parsed.components.find((x) => x.component_id === id);
    if (!c) {
      throw new Error(`重写缺少组件 ${id}，请重试`);
    }
    if (seen.has(c.component_id)) {
      throw new Error(`重写返回重复组件 id：${c.component_id}`);
    }
    seen.add(c.component_id);
    let items = c.items.filter((it) => it.positive_prompt.trim().length >= 8);
    if (items.length > want) {
      items = items.slice(0, want);
    }
    if (items.length < want) {
      throw new Error(
        `${id} 应返回 ${want} 条 items，实际 ${items.length} 条，请重试生成`,
      );
    }
    components.push({ ...c, items });
  }
  for (const c of parsed.components) {
    if (!expectedById.has(c.component_id)) {
      throw new Error(`重写返回未知组件 id：${c.component_id}`);
    }
  }
  return {
    schemaVersion: parsed.schemaVersion ?? DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION,
    components,
  };
}
