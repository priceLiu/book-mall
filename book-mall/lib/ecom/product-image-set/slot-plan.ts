import {
  getStylePresetById,
  resolveStylePresets,
  type EcomStylePresetVertical,
} from "@/lib/ecom/ecom-style-preset";
import type {
  ProductImageSetProject,
  ProductImageSetSettings,
  ProductImageSetSlot,
  ProductImageSetSlotKind,
  ProductImageSetStructureCounts,
  ProductImageSetMeta,
} from "./types";

const KIND_LABEL: Record<ProductImageSetSlotKind, string> = {
  white_bg: "白底图",
  sellpoint: "卖点图",
  scene: "场景 / 模特场景",
  other: "细节 / 辅助图",
};

function kindEntries(counts: ProductImageSetStructureCounts): ProductImageSetSlotKind[] {
  const kinds: ProductImageSetSlotKind[] = [];
  for (let i = 0; i < counts.whiteBg; i++) kinds.push("white_bg");
  for (let i = 0; i < counts.sellpoint; i++) kinds.push("sellpoint");
  for (let i = 0; i < counts.scene; i++) kinds.push("scene");
  for (let i = 0; i < counts.other; i++) kinds.push("other");
  return kinds;
}

function platformLabel(code: string | undefined): string {
  const map: Record<string, string> = {
    amazon: "亚马逊",
    taobao: "淘宝",
    jd: "京东",
  };
  return map[code ?? ""] ?? code ?? "电商平台";
}

function buildStyleBlock(settings: ProductImageSetSettings): string {
  if (!settings.trendingStyleEnabled) return "";
  const presets = resolveStylePresets(settings.selectedTrendingStyleIds);
  if (presets.length === 0) return "";
  return presets.map((p) => p.visualPrompt ?? p.title).join("；");
}

export function buildProductImageSetSlots(project: ProductImageSetProject): ProductImageSetSlot[] {
  const { settings, meta } = project;
  const kinds = kindEntries(settings.structure);
  const styleBlock = buildStyleBlock(settings);
  const sellDoc = meta.sellpointDocument?.trim() ?? "";
  const lang = settings.language ?? "中文";
  const market = settings.market ?? "us";
  const plat = platformLabel(settings.platform);
  const ratio = settings.imageRatio ?? "1:1";

  const layoutIds = [...settings.selectedSellpointLayoutIds];
  let sellpointLayoutIndex = 0;
  let sellpointFreeIndex = 0;

  const slots: ProductImageSetSlot[] = [];
  const kindCounters: Partial<Record<ProductImageSetSlotKind, number>> = {};

  for (const kind of kinds) {
    const n = (kindCounters[kind] ?? 0) + 1;
    kindCounters[kind] = n;
    const title = `${KIND_LABEL[kind]} ${n}`;

    let layoutPresetId: string | undefined;
    let prompt = "";

    if (kind === "white_bg") {
      prompt = [
        `电商${plat}主图，比例${ratio}，纯白或极浅灰渐变背景，产品居中，轻微自然阴影，无多余道具。`,
        sellDoc ? `商品信息：${sellDoc.slice(0, 800)}` : "",
        styleBlock ? `整体调性：${styleBlock}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } else if (kind === "sellpoint") {
      if (sellpointLayoutIndex < layoutIds.length) {
        layoutPresetId = layoutIds[sellpointLayoutIndex];
        sellpointLayoutIndex += 1;
        const preset = getStylePresetById(layoutPresetId);
        prompt = [
          preset?.layoutPrompt ?? "电商卖点图，短标题+产品主体",
          `文案语言：${lang}，目标市场：${market}。`,
          sellDoc ? `卖点资料：${sellDoc.slice(0, 600)}` : "",
          styleBlock ? `视觉氛围：${styleBlock}` : "",
        ].join("\n");
      } else {
        sellpointFreeIndex += 1;
        prompt = [
          "电商卖点图，AI 自由排版，1～2 行短标题，产品清晰，禁止长段落。",
          `文案语言：${lang}。`,
          sellDoc ? `卖点资料：${sellDoc.slice(0, 600)}` : "",
          styleBlock ? `视觉氛围：${styleBlock}` : "",
        ].join("\n");
      }
    } else if (kind === "scene") {
      prompt = [
        `电商场景图，比例${ratio}，真实使用场景，自然光，${plat}高转化风格。`,
        sellDoc ? `商品与卖点：${sellDoc.slice(0, 500)}` : "",
        styleBlock ? `场景氛围：${styleBlock}` : "生活化场景，产品为视觉焦点。",
      ].join("\n");
    } else {
      prompt = [
        "电商辅助图：尺寸图、对比图或规格说明之一，按商品类别智能选择版式，简洁专业。",
        sellDoc ? `规格与卖点参考：${sellDoc.slice(0, 400)}` : "",
        `文案语言：${lang}。`,
      ].join("\n");
    }

    slots.push({
      id: `${kind}-${n}`,
      kind,
      index: slots.length,
      title,
      prompt,
      layoutPresetId,
      status: "pending",
    });
  }

  return slots;
}

export function inferVerticalFromMeta(
  meta: ProductImageSetMeta,
): EcomStylePresetVertical {
  const v = meta.inferredVertical;
  if (
    v === "fashion_apparel" ||
    v === "bags" ||
    v === "digital_3c" ||
    v === "generic"
  ) {
    return v;
  }
  return "generic";
}
