import type { FashionOpsPack } from "@/lib/fashion-types";

/** LLM 有时返回 `{ type, text }` 而非纯字符串，统一转为展示文案 */
export function coerceFashionOpsPackText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text =
      (typeof o.text === "string" && o.text.trim()) ||
      (typeof o.title === "string" && o.title.trim()) ||
      (typeof o.label === "string" && o.label.trim()) ||
      (typeof o.content === "string" && o.content.trim()) ||
      "";
    const type = typeof o.type === "string" ? o.type.trim() : "";
    if (text && type) return `${type}：${text}`;
    return text;
  }
  return String(raw).trim();
}

export function coerceFashionOpsPackStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceFashionOpsPackText).filter(Boolean);
}

export function normalizeFashionOpsPack(ops?: FashionOpsPack | null): FashionOpsPack | null {
  if (!ops) return null;
  return {
    titles: coerceFashionOpsPackStringList(ops.titles),
    coverWords: coerceFashionOpsPackStringList(ops.coverWords),
    tags: coerceFashionOpsPackStringList(ops.tags),
    detailBullets: coerceFashionOpsPackStringList(ops.detailBullets),
    xiaohongshuBody: coerceFashionOpsPackText(ops.xiaohongshuBody),
  };
}
