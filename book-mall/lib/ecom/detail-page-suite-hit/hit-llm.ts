import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import type { DetailPageSuiteBrief } from "@/lib/ecom/detail-page-suite/types";
import {
  DETAIL_PAGE_SUITE_HIT_FENCE,
  DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE,
  DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION,
  DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION,
  DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
  ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY,
} from "@/lib/ecom/detail-page-suite/types";

import {
  extractFenceJson,
  HIT_COMPONENT_LABELS,
  HIT_LAYOUT_LABELS,
  formatHitTemplateValidationError,
  normalizeHitRewrite,
  normalizeHitTemplateDetailed,
  type HitRewrite,
  type NormalizedHitTemplate,
} from "./hit-schemas";
import {
  formatHitGlobalStyleForLlm,
  formatMarketInsightForLlm,
} from "./hit-paradigm-format";
import { HIT_REPEAT_LIMITS_COPY } from "./hit-template-defaults";

function isRetriableHitLlmError(e: unknown): boolean {
  if (isGatewayOrTransportError(e)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /未返回有效 JSON|Unexpected token|JSON|校验失败|schemaVersion|围栏|重写|范式|SyntaxError/.test(
    msg,
  );
}

function isGatewayOrTransportError(e: unknown): boolean {
  if (e instanceof z.ZodError) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (/未返回有效 JSON|校验失败|schemaVersion|不支持|围栏|重写|范式/.test(msg)) {
    return false;
  }
  return true;
}

function buildDecomposeSystem(): string {
  return `你是电商详情页结构拆解专家。输入是淘宝商品详情长截图。
任务：只拆解「页面结构范式、营销叙事逻辑、场景视觉氛围」，禁止提取原图、原文、原模特、原服装、品牌/SKU 字句。
版权红线：
1. 不输出竞品原文句子、不输出像素坐标、不输出原图描述中的可识别服饰花纹/logo。
2. 文案：禁止输出竞品原句；须输出 market_insight（卖点维度方向、用户痛点、叙事顺序、文案口吻、各模块核心文案功能抽象描述）。
3. 视觉：剥离产品/模特主体；global_style 须填满七维氛围参数（场景环境、光影、色调、构图、画面氛围、道具风格、清晰度质感）。

必须只输出围栏 \`\`\`${DETAIL_PAGE_SUITE_HIT_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION}",
  "template_name": "短模板名",
  "canvas_width": 750,
  "category_tag": ["品类"],
  "market_insight": {
    "hot_selling_dimensions": ["面料抗风", "版型显瘦"],
    "user_pain_points": ["冬天灌冷风", "容易起球"],
    "narrative_sequence": "先颜值 → 再面料 → 再穿着体验",
    "copy_style": "简洁硬核/温柔种草/高级极简/生活化",
    "module_copy_functions": ["首屏：季节痛点+利益承诺", "卖点卡：单条功能利益"]
  },
  "global_style": {
    "scene_environment": "室内居家/城市街拍/户外山野/极简棚拍",
    "light_style": "柔光/硬光/逆光/阴天 + 冷暖",
    "color_tone": "莫兰迪/高饱和/高级灰/清透白",
    "composition_style": "全身/半身/细节特写/大远景（整页主基调）",
    "picture_atmosphere": "高级极简/生活化/商业写实",
    "prop_style": "简约高级/生活化/休闲随性",
    "clarity_texture": "高清通透/胶片颗粒/柔焦朦胧"
  },
  "global_copy_style": "与 market_insight.copy_style 一致",
  "component_list": [
    {
      "type": "full_banner|main_product|feature_card|spec_table|detail_closeup|scene_image|contrast|after_sale|other",
      "layout": "full_image|image_text_top_bottom|image_text_left_right|text_only|table",
      "repeat_count": 1,
      "user_editable_count": true,
      "note": "该卡位在叙事中的作用，禁止写原文",
      "text_slot": { "max_char": 18, "text_type": "banner钩子" },
      "image_slot": { "composition": "全身/半身/特写/大远景", "need_scene_bg": true }
    }
  ]
}
规则：
1. component_list 必须按长图从上到下顺序；建议 4～18 条，同类连续块合并为一条。
2. ${HIT_REPEAT_LIMITS_COPY}
3. user_editable_count 默认 true；同类连续多块须合并为一条 component 并写准 repeat_count。
4. type/layout 必须使用上述枚举字面量，禁止自造字段名。
5. 不输出坐标、不输出原文、不输出原图内容。`;
}

export type HitParadigmDecomposeResult = {
  template: NormalizedHitTemplate;
  warnings: string[];
};

function buildRewriteSystem(): string {
  return `你是电商爆款文案策略分析师兼生图提示词专家。
输入：market_insight（爆款卖点维度+痛点+叙事，仅作参考方向）+ global_style 七维视觉氛围 + 用户新品真实卖点。
任务：100%原创重写 slot_copy；并为每个卡位写全新 positive_prompt（场景段须依据 global_style + 该卡位 image_slot，结合新品从零描述背景/光影/道具，禁止复刻竞品画面）。
约束：用户新品卖点优先级最高；与新品不匹配的爆款卖点维度直接舍弃，不强行写入。
禁止抄袭句式、禁止近似原文、禁止编造用户未提供的认证/成分。
画面内禁止文字、logo、水印（写入 negative_prompt）。
positive_prompt 建议结构：「场景：…（全新环境描述）｜商品：…（新品主体与构图）｜氛围：…（引用 global_style 关键词）」
系统全局负向还会拼接：${DETAIL_PAGE_SUITE_NEGATIVE_PROMPT}

必须只输出围栏 \`\`\`${DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION}",
  "components": [
    {
      "component_id": "与输入 id 一致",
      "items": [
        {
          "item_key": "与卡位对应的稳定 key",
          "item_label": "短标题",
          "slot_copy": "分配到该卡位的原创文案，遵守 max_char",
          "positive_prompt": "120～400 字中文生图提示词：新品外观 + 爆款氛围参数 + 该卡位构图",
          "negative_prompt": "补充负向"
        }
      ]
    }
  ]
}
components 的 id 与顺序必须与用户消息中的组件列表完全一致；每条 items 数量必须等于该组件 repeat_count。
banner 输出短钩子；卖点卡输出单条利益点；参数模块输出规格说明；不要把长文塞进 banner。`;
}

function sellpointsBlock(brief: DetailPageSuiteBrief | null): string {
  const lines = brief?.sellPoints?.map((s) => s.text.trim()).filter(Boolean) ?? [];
  if (lines.length === 0) return "";
  return lines.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

export async function runHitParadigmDecompose(opts: {
  userId: string;
  projectId: string;
  referenceImageUrls: string[];
  visionModelKey?: string;
  productDesc?: string | null;
}): Promise<HitParadigmDecomposeResult> {
  const urls = opts.referenceImageUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) throw new Error("请先上传竞品详情长截图");

  const modelKey = opts.visionModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const max = getVisionMaxInputImages(modelKey);
  const imageUrls = urls.slice(0, max);

  const parts: CanvasChatContentPart[] = [
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text" as const,
      text: `商品简述（可忽略，仅作品类参考）：${opts.productDesc?.trim() || "见长图"}。请只拆解结构/叙事/氛围范式。`,
    },
  ];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildDecomposeSystem() },
          { role: "user", content: parts },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(
          opts.userId,
          opts.projectId,
          `${ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY}__decompose`,
        ),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_SUITE_HIT_FENCE);
      return normalizeHitTemplateDetailed(json);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (e instanceof z.ZodError) {
        lastErr = new Error(formatHitTemplateValidationError(e));
      }
      if (!isRetriableHitLlmError(e)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("爆款范式拆解失败");
}

export async function runHitRewrite(opts: {
  userId: string;
  projectId: string;
  template: NormalizedHitTemplate;
  brief: DetailPageSuiteBrief | null;
  chatModelKey?: string;
}): Promise<HitRewrite> {
  const sellpoints = sellpointsBlock(opts.brief);
  if (!sellpoints) {
    throw new Error("请先填写新品核心卖点，再生成原创文案");
  }

  const modelKey = opts.chatModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  const list = opts.template.component_list
    .map((c, i) => {
      const label = HIT_COMPONENT_LABELS[c.type];
      const layout = HIT_LAYOUT_LABELS[c.layout];
      return `${i + 1}. id=${c.id} type=${c.type}（${label}） layout=${c.layout}（${layout}） repeat_count=${c.repeat_count} text_type=${c.text_slot?.text_type ?? "—"} max_char=${c.text_slot?.max_char ?? "—"} composition=${c.image_slot?.composition ?? "—"}`;
    })
    .join("\n");

  const userText = [
    "【本次组件列表】（输出 components 须与此 id、顺序、repeat_count 完全一致）",
    list,
    "",
    `模板名：${opts.template.template_name}`,
    `品类：${(opts.template.category_tag ?? []).join("、") || "未标注"}`,
    `全局文案风格：${opts.template.global_copy_style ?? opts.template.market_insight?.copy_style ?? ""}`,
    "",
    "【爆款洞察 market_insight（参考方向，非原文；与新品冲突则丢弃）】",
    formatMarketInsightForLlm(opts.template.market_insight),
    "",
    "【拆解视觉氛围 global_style（生图 positive_prompt 的场景段须据此 + 新品重写）】",
    formatHitGlobalStyleForLlm(opts.template.global_style),
    "",
    `【新品简述】${opts.brief?.productDesc?.trim() || "（未填）"}`,
    `【新品自有卖点（优先采用）】\n${sellpoints}`,
    "",
    "请原创重写 slot_copy 并分配到各卡位；positive_prompt 须为全新场景描述 + 新品主体。禁止出现竞品原文。",
  ].join("\n");

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildRewriteSystem() },
          { role: "user", content: userText },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(
          opts.userId,
          opts.projectId,
          `${ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY}__rewrite`,
        ),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE);
      return normalizeHitRewrite(
        json,
        opts.template.component_list.map((c) => ({
          id: c.id,
          repeat_count: Math.max(1, c.repeat_count ?? 1),
          type: c.type,
          layout: c.layout,
        })),
      );
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (e instanceof z.ZodError) {
        lastErr = new Error(e.issues[0] ? `重写校验失败：${e.issues[0].message}` : "重写校验失败");
      }
      if (!isRetriableHitLlmError(e)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("原创文案重写失败");
}
