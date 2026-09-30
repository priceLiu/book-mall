import { randomUUID } from "crypto";

import type { DetailPageSuiteSellpoint } from "@/lib/ecom/detail-page-suite/types";

/** 电商工具箱 · 卖点五段式（与助手区提示一致） */
export type EcomSellpointFivePart = {
  productName: string;
  coreSellingPoints: string[];
  targetAudience: string;
  usageScenarios: string[];
  specifications: string[];
};

export const ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES = [
  "建议包含以下信息生成更精准：",
  "1、产品名称",
  "2、核心卖点",
  "3、适用人群",
  "4、使用场景",
  "5、规格参数",
] as const;

export const ECOM_SELLPOINT_FIVE_PART_UI_HINT = ECOM_SELLPOINT_FIVE_PART_UI_HINT_LINES.join("\n");

/** 注入 Vision / LLM system 的 JSON 与排版要求 */
export const ECOM_SELLPOINT_FIVE_PART_LLM_RULES = `输出须覆盖以下五段（内容须来自图片/用户输入，禁止编造未见过的材质、认证、参数）：
1、商品名称：一句话品名
2、核心卖点：3～6 条短句，每条独立一行（功能/体验利益点）
3、适用人群：一句话或分号分隔
4、使用场景：3～5 个场景，可逗号或顿号分隔
5、规格参数：颜色、外观、标识等可见规格，每条一行

识图/生成 JSON 时只输出一个对象（不要 markdown 围栏）：
{
  "product_name": "商品名称",
  "core_selling_points": ["卖点1", "卖点2"],
  "target_audience": "适用人群",
  "usage_scenarios": ["场景1", "场景2"],
  "specifications": ["颜色：…", "外观：…"]
}
usage_scenarios、specifications 可为 string 或 string[]。`;

export const ECOM_SELLPOINT_FIVE_PART_POLISH_RULES = `润色时保持五段结构与原意，只改表述更顺口、更适合电商详情页。
输出同一 JSON 形状；core_selling_points 条数与输入一致；specifications 条数与输入一致；禁止新增未提及的卖点或规格。`;

function normalizeStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[\n,，、;；]+/u)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseEcomSellpointFivePartJson(raw: unknown): EcomSellpointFivePart | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productName = String(o.product_name ?? o.productName ?? "").trim();
  const coreSellingPoints = normalizeStringList(o.core_selling_points ?? o.coreSellingPoints);
  const targetAudience = String(o.target_audience ?? o.targetAudience ?? "").trim();
  const usageScenarios = normalizeStringList(o.usage_scenarios ?? o.usageScenarios);
  const specifications = normalizeStringList(o.specifications);
  if (!productName && coreSellingPoints.length === 0) return null;
  return {
    productName: productName || "（见产品图）",
    coreSellingPoints,
    targetAudience,
    usageScenarios,
    specifications,
  };
}

export function formatEcomSellpointFivePartDocument(part: EcomSellpointFivePart): string {
  const lines: string[] = [];
  lines.push(`1、商品名称：${part.productName.trim()}`);
  lines.push("2、核心卖点：");
  for (const s of part.coreSellingPoints) {
    lines.push(s.trim());
  }
  if (part.targetAudience.trim()) {
    lines.push(`3、适用人群：${part.targetAudience.trim()}`);
  }
  if (part.usageScenarios.length > 0) {
    lines.push(`4、使用场景：${part.usageScenarios.join("、")}`);
  }
  if (part.specifications.length > 0) {
    lines.push("5、规格参数：");
    for (const s of part.specifications) {
      lines.push(s.trim());
    }
  }
  return lines.join("\n").trim();
}

/** 从用户编辑的整段文本解析五段式（识图/手填保存） */
export function parseEcomSellpointFivePartDocument(text: string): EcomSellpointFivePart | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const productNameMatch = trimmed.match(/1[、.．]\s*商品名称[：:]\s*([^\n]+)/u);
  const audienceMatch = trimmed.match(/3[、.．]\s*适用人群[：:]\s*([^\n]+)/u);
  const sceneMatch = trimmed.match(/4[、.．]\s*使用场景[：:]\s*([^\n]+)/u);

  const coreBlock = trimmed.match(/2[、.．]\s*核心卖点[：:]?\s*\n([\s\S]*?)(?=\n\s*3[、.]|$)/u);
  const specBlock = trimmed.match(/5[、.．]\s*规格参数[：:]?\s*\n([\s\S]*?)$/u);

  const coreSellingPoints = (coreBlock?.[1] ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*•·]\s*/, "").trim())
    .filter((l) => l && !/^[345][、.]/.test(l));

  const specifications = (specBlock?.[1] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const productName = productNameMatch?.[1]?.trim() ?? "";
  if (!productName && coreSellingPoints.length === 0) return null;

  const usageScenarios = sceneMatch?.[1]
    ? sceneMatch[1]
        .split(/[、,，;；]+/u)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    productName: productName || "（见产品图）",
    coreSellingPoints,
    targetAudience: audienceMatch?.[1]?.trim() ?? "",
    usageScenarios,
    specifications,
  };
}

export function sellpointFivePartToDetailPageSellpoints(
  part: EcomSellpointFivePart,
  existing?: DetailPageSuiteSellpoint[],
): DetailPageSuiteSellpoint[] {
  return part.coreSellingPoints.map((text, i) => ({
    id: existing?.[i]?.id ?? randomUUID(),
    text: text.trim(),
    source: existing?.[i]?.source ?? ("vision" as const),
  }));
}

export function formatDetailPageSuiteSellpointDraft(brief: {
  sellpointFivePart?: EcomSellpointFivePart | null;
  sellPoints?: DetailPageSuiteSellpoint[];
} | null | undefined): string {
  if (brief?.sellpointFivePart) {
    return formatEcomSellpointFivePartDocument(brief.sellpointFivePart);
  }
  const lines = (brief?.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean);
  return lines.join("\n");
}

export function briefPatchFromSellpointDraft(
  draft: string,
  existingBrief?: {
    sellPoints?: DetailPageSuiteSellpoint[];
    sellpointFivePart?: EcomSellpointFivePart | null;
  } | null,
): {
  sellpointFivePart?: EcomSellpointFivePart;
  sellPoints: DetailPageSuiteSellpoint[];
} {
  const parsed = parseEcomSellpointFivePartDocument(draft);
  if (parsed) {
    return {
      sellpointFivePart: parsed,
      sellPoints: sellpointFivePartToDetailPageSellpoints(parsed, existingBrief?.sellPoints),
    };
  }
  const lines = draft
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    sellpointFivePart: undefined,
    sellPoints: lines.map((text, i) => ({
      id: existingBrief?.sellPoints?.[i]?.id ?? randomUUID(),
      text,
      source: "user" as const,
    })),
  };
}

export function buildSellpointContextForLlm(brief: {
  sellpointFivePart?: EcomSellpointFivePart | null;
  sellPoints?: DetailPageSuiteSellpoint[];
  productDesc?: string | null;
} | null | undefined): string {
  const doc = formatDetailPageSuiteSellpointDraft(brief ?? undefined);
  if (doc.trim()) return doc;
  const legacy = (brief?.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean).join("，");
  if (legacy) return legacy;
  return brief?.productDesc?.trim() ?? "";
}
