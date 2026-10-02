import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  getStylePresetByIdLive,
  resolveStylePresetsLive,
} from "@/lib/ecom/ecom-style-preset";
import { productImageSetPlatformLabel } from "@/lib/ecom/ecom-generation-settings-catalog";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import {
  assertProductImageSetPlanPromptQuality,
  parseProductImageSetPlanItems,
} from "./plan-parse";
import {
  ECOM_PRODUCT_IMAGE_SET_PLAN_ACTION,
  ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
  type ProductImageSetProject,
  type ProductImageSetSlot,
  type ProductImageSetSlotKind,
} from "./types";

const PLAN_BATCH_SIZE = 5;

const KIND_ROLE: Record<ProductImageSetSlotKind, string> = {
  white_bg: "白底图：纯白/极浅底，商品居中，适合平台主图规范",
  sellpoint: "卖点图：海报排版，短标题+产品主体，可含卖点文案",
  scene: "场景图 / 模特场景：真实使用场景或模特上身/互动，生活化或商业棚拍",
  other: "细节图 / 辅助图：特写、尺码对比、参数说明、多功能拆解等",
};

const PLAN_SYSTEM = `你是跨境电商 AI 套图策划与文生图 Prompt 专家。
用户会提供：① 商品实拍（多张）② 卖点五段式资料 ③ 可选爆款视觉风格 ④ 套图结构 ⑤ 本批槽位清单（id 已给定，不可增删）。
你的任务：为清单中 **每一条 id** 写出独立、可执行的 **中文文生图 prompt**（每条 80～220 字，须具体可拍，禁止套话模板）。

下游生图时会 **同时传入商品实拍 + 你写的 prompt**（参考图生图）。须强调与实拍 **同款** 颜色/版型/材质/Logo。

必须只输出一个 JSON 对象（不要 markdown 围栏，不要解释）：
{
  "items": [
    { "id": "必须与清单完全一致", "prompt": "完整生图指令", "title": "可选短标题" }
  ]
}

硬性要求：
1. items 数量与本批 slots 数量一致；id 必须从 user 消息「本批 id 列表」中原样复制（含 white_bg-1 这类下划线与连字符）。
2. 卖点图须写清文案层级与语言；场景/模特类可含人物；细节类可含特写/参数。
3. 禁止输出「电商卖点图，AI 自由排版」等空泛模板句。`;

function structureSummary(settings: ProductImageSetProject["settings"]): string {
  const c = settings.structure;
  return [
    "套图结构数量（全项目）：",
    `- 白底图：${c.whiteBg} 张`,
    `- 卖点图：${c.sellpoint} 张`,
    `- 场景 / 模特场景：${c.scene} 张`,
    `- 细节 / 辅助图：${c.other} 张`,
  ].join("\n");
}

async function buildSellpointLayoutContext(project: ProductImageSetProject): Promise<string> {
  const ids = project.settings.selectedSellpointLayoutIds;
  if (ids.length === 0) return "";
  const presets = await resolveStylePresetsLive(ids);
  if (presets.length === 0) return "";
  return [
    "卖点图版式参考（按槽位顺序对应清单中的卖点图 id）：",
    ...presets.map((p, i) => `${i + 1}. ${p.title}：${p.layoutPrompt ?? p.subtitle ?? ""}`),
  ].join("\n");
}

function platformLabel(code: string | undefined): string {
  return productImageSetPlatformLabel(code);
}

async function buildStyleContext(project: ProductImageSetProject): Promise<string> {
  const lines: string[] = [];
  if (project.settings.trendingStyleEnabled) {
    const presets = await resolveStylePresetsLive(project.settings.selectedTrendingStyleIds);
    if (presets.length > 0) {
      lines.push(
        "爆款视觉风格（整组调性）：",
        ...presets.map((p) => `- ${p.title}：${p.visualPrompt ?? p.subtitle ?? ""}`),
      );
    }
  }
  return lines.join("\n");
}

async function buildSlotManifestLines(slots: ProductImageSetSlot[]): Promise<string[]> {
  const lines: string[] = [];
  for (const slot of slots) {
    let layoutHint = "";
    if (slot.layoutPresetId) {
      const preset = await getStylePresetByIdLive(slot.layoutPresetId);
      if (preset?.layoutPrompt) {
        layoutHint = `\n  版式参考：${preset.title} — ${preset.layoutPrompt}`;
      }
    }
    lines.push(
      `- id=${slot.id} | 类型=${KIND_ROLE[slot.kind]} | 默认标题=${slot.title}${layoutHint}`,
    );
  }
  return lines;
}

function chunkSlots(slots: ProductImageSetSlot[], size: number): ProductImageSetSlot[][] {
  const out: ProductImageSetSlot[][] = [];
  for (let i = 0; i < slots.length; i += size) {
    out.push(slots.slice(i, i + size));
  }
  return out;
}

async function invokePlanBatch(opts: {
  userId: string;
  projectId: string;
  visionKey: string;
  project: ProductImageSetProject;
  batch: ProductImageSetSlot[];
  sharedUserPrefix: string;
  imageParts: CanvasChatContentPart[];
  repairHint?: string;
}): Promise<Map<string, { prompt: string; title?: string }>> {
  const expectedIds = new Set(opts.batch.map((s) => s.id));
  const manifest = await buildSlotManifestLines(opts.batch);
  const idList = opts.batch.map((s) => s.id).join(", ");

  const userText = [
    opts.sharedUserPrefix,
    "",
    opts.repairHint,
    opts.repairHint ? "" : null,
    `本批 id 列表（items[].id 必须与此完全一致）：${idList}`,
    "",
    "本批套图结构清单：",
    ...manifest,
    "",
    "请输出 JSON items。",
  ]
    .filter((x) => x !== null)
    .join("\n");

  const parts: CanvasChatContentPart[] = [
    ...opts.imageParts,
    { type: "text" as const, text: userText },
  ];

  const raw = await drainEcomGwChat(opts.userId, {
    modelKey: opts.visionKey,
    messages: [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: parts },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(
      opts.userId,
      opts.projectId,
      `${ECOM_PRODUCT_IMAGE_SET_TOOL_KEY}__${ECOM_PRODUCT_IMAGE_SET_PLAN_ACTION}`,
    ),
  });

  const map = parseProductImageSetPlanItems(raw, expectedIds);
  assertProductImageSetPlanPromptQuality(map);
  return map;
}

export async function llmFillProductImageSetPrompts(opts: {
  userId: string;
  projectId: string;
  project: ProductImageSetProject;
  skeleton: ProductImageSetSlot[];
  modelKey?: string;
}): Promise<ProductImageSetSlot[]> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const visionKey =
    opts.modelKey?.trim() ||
    opts.project.settings.visionModelKey?.trim() ||
    ECOM_DEFAULT_VISION_MODEL;
  await assertStoryLlmVisionModel(visionKey);

  const refUrls = opts.project.references.map((r) => r.ossUrl).filter(Boolean);
  const sellDoc = opts.project.meta.sellpointDocument?.trim() ?? "";
  const settings = opts.project.settings;
  const ratio = settings.imageRatio ?? "1:1";
  const styleBlock = await buildStyleContext(opts.project);
  const layoutBlock = await buildSellpointLayoutContext(opts.project);
  const userLayoutRefs = opts.project.settings.userLayoutRefs ?? [];

  const sharedUserPrefix = [
    `平台：${platformLabel(settings.platform)}`,
    `市场：${settings.market ?? "us"}`,
    `文案语言：${settings.language ?? "中文"}`,
    `出图比例：${ratio}`,
    "",
    structureSummary(settings),
    "",
    sellDoc ? `卖点与要求（五段式）：\n${sellDoc}` : "（用户尚未填写卖点，请根据商品图推断并写入各 prompt）",
    styleBlock ? `\n${styleBlock}` : "",
    layoutBlock ? `\n${layoutBlock}` : "",
    userLayoutRefs.length > 0
      ? `\n用户自定义版式参考图（共 ${userLayoutRefs.length} 张，已随消息附图）`
      : "",
  ].join("\n");

  const layoutRefParts: CanvasChatContentPart[] = userLayoutRefs
    .slice(0, 4)
    .map((r) => ({
      type: "image_url" as const,
      image_url: { url: r.ossUrl },
    }));

  const imageParts: CanvasChatContentPart[] = [
    ...refUrls.slice(0, 6).map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
    ...layoutRefParts,
  ];

  const batches = chunkSlots(opts.skeleton, PLAN_BATCH_SIZE);
  const merged = new Map<string, { prompt: string; title?: string }>();

  for (const batch of batches) {
    try {
      const map = await invokePlanBatch({
        userId: opts.userId,
        projectId: opts.projectId,
        visionKey,
        project: opts.project,
        batch,
        sharedUserPrefix,
        imageParts,
      });
      for (const [k, v] of map) merged.set(k, v);
    } catch (e) {
      const firstErr = e instanceof Error ? e : new Error(String(e));
      const idList = batch.map((s) => s.id).join(", ");
      const map = await invokePlanBatch({
        userId: opts.userId,
        projectId: opts.projectId,
        visionKey,
        project: opts.project,
        batch,
        sharedUserPrefix,
        imageParts,
        repairHint: [
          `上次输出无效（${firstErr.message}）。`,
          "禁止输出「电商卖点图，AI 自由排版」「电商场景图，比例」「电商辅助图：尺寸图」等系统模板句。",
          `每条 prompt 须 80 字以上、含具体商品/场景/光影/构图，并引用卖点资料。`,
          `id 必须从下列列表原样复制：${idList}`,
        ].join("\n"),
      });
      for (const [k, v] of map) merged.set(k, v);
    }
  }

  if (merged.size !== opts.skeleton.length) {
    throw new Error(
      `套图 Prompt 合并不完整：期望 ${opts.skeleton.length} 条，得到 ${merged.size} 条`,
    );
  }

  return opts.skeleton.map((slot) => {
    const filled = merged.get(slot.id);
    if (!filled) return slot;
    return {
      ...slot,
      prompt: filled.prompt,
      title: filled.title ?? slot.title,
    };
  });
}
