/**
 * 影视专业版 2.0 · 剧本「视觉风格总纲」结构化解析与全片生图锚定
 */
import { extractMarkdownSectionByHeaderLevels } from "./parse-md-tables";

export type StoryProVisualStylePack = {
  /** 故事背景 / 世界观 */
  worldBackground?: string;
  /** 年代（如唐代长安、近未来赛博） */
  era?: string;
  /** 画面风格（如电影级写实、国风水墨） */
  visualStyle?: string;
  /** 色调卡（主色 + 辅助色 + 禁忌色） */
  colorPalette?: string;
  /** 光影基调 */
  lighting?: string;
  /** 画幅比例建议 */
  aspectRatioHint?: string;
  /** 中文风格锚定（供 Dock 展示 / 中文模型） */
  styleAnchorZh?: string;
  /** 英文风格锚定（Gateway 生图 prepend） */
  styleAnchorEn?: string;
  /** 负向词（可选） */
  negativePrompt?: string;
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickTableCell(
  row: Record<string, string>,
  aliases: string[],
): string {
  for (const [key, val] of Object.entries(row)) {
    const nk = normHeader(key);
    if (aliases.some((a) => nk === a || nk.includes(a))) return (val ?? "").trim();
  }
  return "";
}

function pickBulletField(section: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      `(?:^|\\n)\\s*(?:[-*]|\\d+[.)])?\\s*\\**${label}\\**\\s*[:：]\\s*([^\\n#]+)`,
      "im",
    );
    const m = section.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

/** 从大纲 ## 视觉风格总纲 解析全片视觉锚定（GFM 表或条目列表） */
export function parseVisualStylePackFromOutline(
  outlineMd: string,
): StoryProVisualStylePack | null {
  const section = extractMarkdownSectionByHeaderLevels(
    outlineMd ?? "",
    /视觉风格总纲/,
    [2, 3, 1],
  ).trim();
  if (!section) return null;

  const pack: StoryProVisualStylePack = {};
  const tableMatch = section.match(/\|[^\n]+\|\n\|[-:\s|]+\|\n([\s\S]*?)(?=\n##|\n#|$)/);
  if (tableMatch) {
    const headerLine = section.match(/^\|([^\n]+)\|/m);
    const headers =
      headerLine?.[1]
        ?.split("|")
        .map((h) => h.trim())
        .filter(Boolean) ?? [];
    const dimIdx = headers.findIndex((h) =>
      /维度|字段|项/.test(h),
    );
    const valIdx = headers.findIndex(
      (h, i) => i !== dimIdx && /内容|说明|描述|值/.test(h),
    );
    const body = tableMatch[1] ?? "";
    for (const line of body.split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length);
      if (cells.length < 2) continue;
      const dim = (dimIdx >= 0 ? cells[dimIdx] : cells[0]) ?? "";
      const val = (valIdx >= 0 ? cells[valIdx] : cells[1]) ?? "";
      assignVisualStyleField(pack, dim, val);
    }
  }

  assignVisualStyleField(
    pack,
    "故事背景",
    pickBulletField(section, [
      "故事背景",
      "世界观",
      "背景设定",
      "时代背景",
    ]),
  );
  assignVisualStyleField(pack, "年代", pickBulletField(section, ["年代", "时代"]));
  assignVisualStyleField(
    pack,
    "画面风格",
    pickBulletField(section, ["画面风格", "视觉风格", "整体美学", "风格"]),
  );
  assignVisualStyleField(
    pack,
    "色调卡",
    pickBulletField(section, ["色调卡", "色调", "色彩基调", "配色"]),
  );
  assignVisualStyleField(
    pack,
    "光影",
    pickBulletField(section, ["光影基调", "光影", "照明"]),
  );
  assignVisualStyleField(
    pack,
    "画幅",
    pickBulletField(section, ["画幅", "比例", "画幅比例"]),
  );
  assignVisualStyleField(
    pack,
    "英文风格锚定",
    pickBulletField(section, [
      "英文风格锚定",
      "英文风格锚定词",
      "English style anchor",
    ]),
  );

  if (!pack.styleAnchorZh) {
    const prose = section
      .replace(/\|[^\n]+\|\n\|[-:\s|]+\|\n[\s\S]*?(?=\n##|\n#|$)/, "")
      .replace(/^#+\s*[^\n]+\n?/gm, "")
      .trim()
      .split(/\n{2,}/)[0]
      ?.trim();
    if (prose && prose.length >= 12 && !prose.startsWith("|")) {
      pack.styleAnchorZh = prose.slice(0, 480);
    }
  }

  pack.styleAnchorEn =
    pack.styleAnchorEn?.trim() ||
    buildVisualStyleAnchorEn(pack) ||
    undefined;

  const hasContent = Boolean(
    pack.worldBackground?.trim() ||
      pack.era?.trim() ||
      pack.visualStyle?.trim() ||
      pack.colorPalette?.trim() ||
      pack.styleAnchorZh?.trim() ||
      pack.styleAnchorEn?.trim(),
  );
  return hasContent ? pack : null;
}

function assignVisualStyleField(
  pack: StoryProVisualStylePack,
  dim: string,
  val: string,
): void {
  const d = dim.trim();
  const v = val.trim();
  if (!d || !v) return;
  if (/背景|世界观/.test(d)) pack.worldBackground = v;
  else if (/年代|时代/.test(d)) pack.era = v;
  else if (/画面风格|视觉风格|整体美学|^风格$/.test(d)) pack.visualStyle = v;
  else if (/色调|配色|色彩/.test(d)) pack.colorPalette = v;
  else if (/光影|照明/.test(d)) pack.lighting = v;
  else if (/画幅|比例/.test(d)) pack.aspectRatioHint = v;
  else if (/英文|english/i.test(d)) pack.styleAnchorEn = v;
  else if (/负向|negative/i.test(d)) pack.negativePrompt = v;
  else if (/中文.*锚|风格锚/.test(d)) pack.styleAnchorZh = v;
}

export function buildVisualStyleAnchorEn(
  pack: StoryProVisualStylePack,
): string {
  const parts = [
    pack.visualStyle?.trim(),
    pack.era?.trim() ? `era: ${pack.era.trim()}` : "",
    pack.colorPalette?.trim() ? `color palette: ${pack.colorPalette.trim()}` : "",
    pack.lighting?.trim() ? `lighting: ${pack.lighting.trim()}` : "",
    pack.worldBackground?.trim()
      ? `setting: ${pack.worldBackground.trim()}`
      : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export function buildVisualStyleAnchorZh(
  pack: StoryProVisualStylePack,
): string {
  if (pack.styleAnchorZh?.trim()) return pack.styleAnchorZh.trim();
  const parts = [
    pack.worldBackground?.trim() ? `背景：${pack.worldBackground.trim()}` : "",
    pack.era?.trim() ? `年代：${pack.era.trim()}` : "",
    pack.visualStyle?.trim() ? `风格：${pack.visualStyle.trim()}` : "",
    pack.colorPalette?.trim() ? `色调：${pack.colorPalette.trim()}` : "",
    pack.lighting?.trim() ? `光影：${pack.lighting.trim()}` : "",
  ].filter(Boolean);
  return parts.join("；");
}

/** 追加到场景/三视图/道具 Dock 提示词末尾的全片风格约束 */
export function appendVisualStylePackToPrompt(
  prompt: string,
  pack: StoryProVisualStylePack | null | undefined,
): string {
  const base = prompt.trim();
  if (!pack) return base;
  const zh = buildVisualStyleAnchorZh(pack);
  const en = pack.styleAnchorEn?.trim() || buildVisualStyleAnchorEn(pack);
  const lines = [
    base,
    zh ? `\n【全片视觉】${zh}` : "",
    en ? `\n[Global visual style] ${en}` : "",
  ].filter(Boolean);
  return lines.join("");
}
