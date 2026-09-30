import type { FashionSellpoint } from "@/lib/fashion-types";
import { parseEcomSellpointFivePartDocument } from "@/lib/ecom-sellpoint-five-part";

export type UserSellpointParseResult = {
  sellpoints: FashionSellpoint[];
  /** 五段式手填时的商品名称 */
  productName?: string;
  fivePart: boolean;
};

function nextSellpointId(index: number): string {
  return `S${String(index).padStart(2, "0")}`;
}

function sellpointsFromFivePartDocument(text: string): UserSellpointParseResult | null {
  const five = parseEcomSellpointFivePartDocument(text);
  if (!five) return null;
  const sellpoints: FashionSellpoint[] = [];
  let i = 1;
  for (const t of five.coreSellingPoints) {
    sellpoints.push({ id: nextSellpointId(i++), text: t, layer: "core", source: "user" });
  }
  for (const t of five.specifications) {
    sellpoints.push({ id: nextSellpointId(i++), text: t, layer: "visual", source: "user" });
  }
  if (five.targetAudience.trim()) {
    sellpoints.push({
      id: nextSellpointId(i++),
      text: `适用人群：${five.targetAudience.trim()}`,
      layer: "aux",
      source: "user",
    });
  }
  if (five.usageScenarios.length > 0) {
    sellpoints.push({
      id: nextSellpointId(i++),
      text: `使用场景：${five.usageScenarios.join("、")}`,
      layer: "aux",
      source: "user",
    });
  }
  if (sellpoints.length === 0) return null;
  return {
    sellpoints,
    productName: five.productName.trim() || undefined,
    fivePart: true,
  };
}

/** 用户自由输入的卖点文案 → 结构化 S01…（默认 core / user，可在中栏改分层） */
export function parseUserSellpointInput(text: string): UserSellpointParseResult {
  const fromDoc = sellpointsFromFivePartDocument(text);
  if (fromDoc) return fromDoc;

  const trimmed = text.trim();
  if (!trimmed) return { sellpoints: [], fivePart: false };

  const rawParts = trimmed
    .split(/\n+|[;；]|(?=\d+[.、)])/u)
    .map((part) => part.replace(/^\s*[-*•·]\s*/, "").trim())
    .filter((part) => part.length >= 2);

  const parts = rawParts.length > 0 ? rawParts : trimmed.length >= 2 ? [trimmed] : [];

  return {
    sellpoints: parts.map((sellpointText, index) => ({
      id: nextSellpointId(index + 1),
      text: sellpointText,
      layer: "core",
      source: "user",
    })),
    fivePart: false,
  };
}

export function parseUserSellpointText(text: string): FashionSellpoint[] {
  return parseUserSellpointInput(text).sellpoints;
}
