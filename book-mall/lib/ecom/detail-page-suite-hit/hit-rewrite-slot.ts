import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import type { DetailPageSuiteBrief } from "@/lib/ecom/detail-page-suite/types";
import {
  DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE,
  DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION,
  ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY,
} from "@/lib/ecom/detail-page-suite/types";

import {
  extractFenceJson,
  HIT_COMPONENT_LABELS,
  HIT_LAYOUT_LABELS,
  type HitRewrite,
  type NormalizedHitTemplate,
} from "./hit-schemas";
import {
  formatHitGlobalStyleForLlm,
  formatMarketInsightForLlm,
} from "./hit-paradigm-format";
import { hitSlotCopyRequired } from "./hit-slot-copy-rules";

type HitRewriteItem = HitRewrite["components"][number]["items"][number];

const HitRewriteItemFieldsSchema = z.object({
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  slot_copy: z.string().optional(),
  positive_prompt: z.string().min(8),
  negative_prompt: z.string().optional(),
});

const HitRewriteSingleItemSchema = z.object({
  schemaVersion: z.string().optional(),
  item: HitRewriteItemFieldsSchema,
});

function coerceSingleSlotRewriteItem(
  raw: unknown,
  fallback: { itemKey: string; itemLabel: string },
): z.infer<typeof HitRewriteItemFieldsSchema> {
  if (!raw || typeof raw !== "object") {
    throw new Error("单条重写返回非 JSON 对象");
  }
  const o = raw as Record<string, unknown>;

  if (o.item && typeof o.item === "object") {
    return HitRewriteItemFieldsSchema.parse(o.item);
  }

  const comps = o.components;
  if (Array.isArray(comps) && comps.length > 0) {
    const first = comps[0] as Record<string, unknown>;
    const items = first.items;
    if (Array.isArray(items) && items.length > 0) {
      return HitRewriteItemFieldsSchema.parse(items[0]);
    }
  }

  if ("positive_prompt" in o) {
    return HitRewriteItemFieldsSchema.parse({
      item_key: typeof o.item_key === "string" ? o.item_key : fallback.itemKey,
      item_label: typeof o.item_label === "string" ? o.item_label : fallback.itemLabel,
      slot_copy: o.slot_copy,
      positive_prompt: o.positive_prompt,
      negative_prompt: o.negative_prompt,
    });
  }

  throw new Error("单条重写 JSON 格式无法识别（需 item 或 components[0].items[0]）");
}

function isGatewayOrTransportError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch failed|ECONNRESET|502|503|504|upstream|timeout/i.test(msg);
}

function isRetriableHitSlotRewriteError(e: unknown): boolean {
  if (isGatewayOrTransportError(e)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /未返回有效 JSON|Unexpected token|JSON|校验失败|缺少模块文案|格式无法识别/.test(msg);
}

function sellpointsBlock(brief: DetailPageSuiteBrief | null): string {
  const lines = brief?.sellPoints?.map((s) => s.text.trim()).filter(Boolean) ?? [];
  if (lines.length === 0) return "";
  return lines.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function buildSingleSlotRewriteSystem(): string {
  return `你是电商爆款文案策略分析师兼生图提示词专家。
任务：为单个详情页卡位 100%原创重写 slot_copy，并写全新 positive_prompt。
约束：用户新品卖点优先级最高；禁止抄袭、禁止编造未提供的认证。
必须只输出围栏 \`\`\`${DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION}",
  "item": {
    "item_key": "与输入一致",
    "item_label": "短标题",
    "slot_copy": "原创模块文案，遵守 max_char",
    "positive_prompt": "120～400 字中文生图提示词",
    "negative_prompt": "补充负向"
  }
}`;
}

export async function runHitRewriteSingleSlot(opts: {
  userId: string;
  projectId: string;
  template: NormalizedHitTemplate;
  brief: DetailPageSuiteBrief | null;
  componentId: string;
  slotIndex: number;
  itemKey: string;
  itemLabel: string;
  chatModelKey?: string;
}): Promise<HitRewriteItem> {
  const sellpoints = sellpointsBlock(opts.brief);
  if (!sellpoints) {
    throw new Error("请先填写新品核心卖点");
  }

  const comp = opts.template.component_list.find((c) => c.id === opts.componentId);
  if (!comp) throw new Error("组件不存在");

  const modelKey = opts.chatModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  const label = HIT_COMPONENT_LABELS[comp.type];
  const layout = HIT_LAYOUT_LABELS[comp.layout];
  const copyRequired = hitSlotCopyRequired(comp);

  const userText = [
    `【单卡位】component_id=${comp.id} type=${comp.type}（${label}） layout=${comp.layout}（${layout}） index=${opts.slotIndex + 1}`,
    `item_key=${opts.itemKey} item_label=${opts.itemLabel}`,
    `text_type=${comp.text_slot?.text_type ?? "—"} max_char=${comp.text_slot?.max_char ?? "—"}`,
    `composition=${comp.image_slot?.composition ?? "—"}`,
    "",
    `模板名：${opts.template.template_name}`,
    "",
    "【爆款洞察 market_insight】",
    formatMarketInsightForLlm(opts.template.market_insight),
    "",
    "【视觉氛围 global_style】",
    formatHitGlobalStyleForLlm(opts.template.global_style),
    "",
    `【新品简述】${opts.brief?.productDesc?.trim() || "（未填）"}`,
    `【新品自有卖点】\n${sellpoints}`,
    "",
    copyRequired
      ? "须输出非空 slot_copy（遵守 max_char）。"
      : "若该格为纯画面可无 slot_copy，但建议仍给短辅助文案。",
    "positive_prompt 须为全新场景 + 新品主体，禁止竞品原文。",
  ].join("\n");

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildSingleSlotRewriteSystem() },
          { role: "user", content: userText },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(
          opts.userId,
          opts.projectId,
          `${ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY}__rewrite-slot`,
        ),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE);
      const item = coerceSingleSlotRewriteItem(json, {
        itemKey: opts.itemKey,
        itemLabel: opts.itemLabel,
      });
      if (copyRequired && !item.slot_copy?.trim()) {
        throw new Error("缺少模块文案，请重试");
      }
      return {
        item_key: item.item_key.trim() || opts.itemKey,
        item_label: item.item_label.trim() || opts.itemLabel,
        slot_copy: item.slot_copy?.trim(),
        positive_prompt: item.positive_prompt.trim(),
        negative_prompt: item.negative_prompt?.trim(),
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (e instanceof z.ZodError) {
        lastErr = new Error(
          `单条重写 JSON 校验失败：${e.issues[0]?.message ?? "字段不完整"}`,
        );
      }
      if (!isRetriableHitSlotRewriteError(e)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("单条重写失败");
}
