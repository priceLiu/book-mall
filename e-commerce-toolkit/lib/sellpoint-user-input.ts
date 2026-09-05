import type { FashionSellpoint } from "@/lib/fashion-types";

/** 用户自由输入的卖点文案 → 结构化 S01…（默认 core / user，可在中栏改分层） */
export function parseUserSellpointText(text: string): FashionSellpoint[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const rawParts = trimmed
    .split(/\n+|[;；]|(?=\d+[.、)])/u)
    .map((part) => part.replace(/^\s*[-*•·]\s*/, "").trim())
    .filter((part) => part.length >= 2);

  const parts = rawParts.length > 0 ? rawParts : trimmed.length >= 2 ? [trimmed] : [];

  return parts.map((sellpointText, index) => ({
    id: `S${String(index + 1).padStart(2, "0")}`,
    text: sellpointText,
    layer: "core",
    source: "user",
  }));
}
