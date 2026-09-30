/**
 * 与 book-mall/lib/ecom/ecom-sellpoint-five-part.ts 保持同步（前端展示与手填保存）
 */
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

export const ECOM_SELLPOINT_FIVE_PART_PLACEHOLDER = `1、商品名称：
2、核心卖点：
（每行一条）
3、适用人群：
4、使用场景：
5、规格参数：`;

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

export function formatDetailPageSuiteSellpointDraft(brief: {
  sellpointFivePart?: EcomSellpointFivePart | null;
  sellPoints?: Array<{ text: string }>;
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
    sellPoints?: Array<{ id: string; text: string; source: "user" | "vision" | "ai" }>;
    sellpointFivePart?: EcomSellpointFivePart | null;
  } | null,
): {
  sellpointFivePart?: EcomSellpointFivePart;
  sellPoints: Array<{ id: string; text: string; source: "user" | "vision" | "ai" }>;
} {
  const parsed = parseEcomSellpointFivePartDocument(draft);
  if (parsed) {
    return {
      sellpointFivePart: parsed,
      sellPoints: parsed.coreSellingPoints.map((text, i) => ({
        id: existingBrief?.sellPoints?.[i]?.id ?? `sp-${i}`,
        text,
        source: existingBrief?.sellPoints?.[i]?.source ?? ("user" as const),
      })),
    };
  }
  const lines = draft
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    sellpointFivePart: undefined,
    sellPoints: lines.map((text, i) => ({
      id: existingBrief?.sellPoints?.[i]?.id ?? `sp-${i}`,
      text,
      source: "user" as const,
    })),
  };
}
