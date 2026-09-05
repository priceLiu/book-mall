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
  else if (/年代\/环境|年代|时代|环境定位/.test(d)) {
    pack.era = pack.era ? `${pack.era}; ${v}` : v;
  } else if (/摄影风格|镜头/.test(d)) {
    pack.lighting = pack.lighting ? `${pack.lighting}; ${v}` : v;
  } else if (/画面风格|视觉风格|整体美学|^风格$/.test(d)) pack.visualStyle = v;
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

const THREE_VIEW_DEFAULT_LIGHTING =
  "自然日光感，主光源来自右后方的侧逆光，辅光来自左前方柔和补光，以清晰呈现面部细节。拒绝平光。";

const THREE_VIEW_DEFAULT_LENS =
  "模拟 35mm 焦距，光圈 f/2.8 的浅景深，带有轻微电影颗粒感";

function threeViewVisualStyleTitle(pack: StoryProVisualStylePack): string {
  const label =
    pack.visualStyle?.trim() ||
    pack.styleAnchorZh?.trim()?.slice(0, 24) ||
    "写实摄影风";
  return `【全局视觉风格 - ${label.slice(0, 48)}】`;
}

function resolveThreeViewLensEffect(pack: StoryProVisualStylePack): string {
  const combined = [
    pack.lighting,
    pack.styleAnchorZh,
    pack.visualStyle,
  ]
    .filter(Boolean)
    .join(" ");
  if (/35mm|50mm|85mm|f\/\d|浅景深|镜头/i.test(combined)) {
    const m = combined.match(
      /(?:模拟\s*)?\d+mm[^。\n]*(?:f\/[\d.]+[^。\n]*)?|(?:浅景深|镜头)[^。\n]*/i,
    );
    if (m?.[0]?.trim()) return m[0].trim().replace(/^[，,；;]\s*/, "");
  }
  return THREE_VIEW_DEFAULT_LENS;
}

/** 三视图专用 · 全局视觉块（置于【角色设定】之后） */
export function formatThreeViewVisualStyleSection(
  pack: StoryProVisualStylePack | null | undefined,
): string {
  if (!pack) return "";
  const hasContent = Boolean(
    pack.visualStyle?.trim() ||
      pack.lighting?.trim() ||
      pack.colorPalette?.trim() ||
      pack.era?.trim() ||
      pack.worldBackground?.trim() ||
      pack.styleAnchorZh?.trim() ||
      pack.styleAnchorEn?.trim(),
  );
  if (!hasContent) return "";

  const lines: string[] = [threeViewVisualStyleTitle(pack)];

  if (pack.visualStyle?.trim()) {
    const style = pack.visualStyle.trim();
    const positioning = /拒绝|禁止|二维|插画|动漫/.test(style)
      ? style
      : `${style}；拒绝二维插画或动漫风格`;
    lines.push(`- 风格定位：${positioning}`);
  } else {
    lines.push(
      "- 风格定位：照片级写实，电影感真人拍摄风格，拒绝二维插画或动漫风格",
    );
  }

  lines.push(
    `- 光线设定：${pack.lighting?.trim() || THREE_VIEW_DEFAULT_LIGHTING}`,
  );
  lines.push(`- 镜头效果：${resolveThreeViewLensEffect(pack)}`);

  if (pack.colorPalette?.trim()) {
    lines.push(`- 色调方向：${pack.colorPalette.trim()}`);
  }

  const eraMood = [pack.era?.trim(), pack.worldBackground?.trim()]
    .filter(Boolean)
    .join("，");
  if (eraMood) {
    lines.push(
      `- 时代气氛：参考${eraMood}美学，但背景为纯白，因此通过光影和色调传递氛围，不绘制实际场景。`,
    );
  }

  lines.push(
    "- 环境光适配：由于背景纯白，所有材质（丝绸、金属、皮肤）应反射柔和的白色环境光，呈现摄影棚质感，高光自然不溢出。",
  );

  return lines.join("\n");
}

/** prompt 是否已嵌入全片/全局视觉块 */
export function promptHasEmbeddedVisualStyleBlock(prompt: string): boolean {
  const t = prompt.trim();
  return (
    t.includes("【全局视觉风格") ||
    t.includes("【全片视觉") ||
    t.includes("[Global visual style]") ||
    t.includes("[视觉风格：")
  );
}

/** Dock 顶部 · 全片视觉块（与 Pro2VisualStylePackBar 同源，写入 dockInput 供用户编辑） */
export function formatVisualStylePackDockSection(
  pack: StoryProVisualStylePack | null | undefined,
): string {
  if (!pack) return "";
  const zh = buildVisualStyleAnchorZh(pack);
  if (!zh) return "";
  const lines = ["【全片视觉 · 生图统一风格】", zh];
  return lines.join("\n");
}

/** 全片视觉块置于 Dock 顶部（用户可在 textarea 内直接改） */
export function prependVisualStylePackToDockPrompt(
  prompt: string,
  pack: StoryProVisualStylePack | null | undefined,
): string {
  const base = prompt.trim();
  const section = formatVisualStylePackDockSection(pack);
  if (!section) return base;
  if (!base) return section;
  if (base.includes("【全片视觉") || base.includes("【全局视觉风格")) return base;
  return `${section}\n\n${base}`;
}

/** 全片视觉块置于 Dock 末尾（场景图等 · 三视图请用 assembleThreeViewPrompt） */
export function appendVisualStylePackToDockPrompt(
  prompt: string,
  pack: StoryProVisualStylePack | null | undefined,
): string {
  const base = prompt.trim();
  const section = formatVisualStylePackDockSection(pack);
  if (!section) return base;
  if (promptHasEmbeddedVisualStyleBlock(base)) return base;
  if (!base) return section;
  return `${base}\n\n${section}`;
}

/** 追加到场景/三视图/道具 Dock 提示词末尾的全片风格约束 */
export function appendVisualStylePackToPrompt(
  prompt: string,
  pack: StoryProVisualStylePack | null | undefined,
): string {
  const base = prompt.trim();
  if (!pack) return base;
  const zh = buildVisualStyleAnchorZh(pack);
  const lines = [base, zh ? `\n【全片视觉】${zh}` : ""].filter(Boolean);
  return lines.join("");
}

/** Hub data · 优先 visualStylePack，否则从故事大纲「视觉风格总纲」解析 */
export function resolveHubVisualStylePackFromHubData(
  d:
    | {
        visualStylePack?: StoryProVisualStylePack | null;
        outlineMd?: string | null;
      }
    | null
    | undefined,
): StoryProVisualStylePack | null {
  if (!d) return null;
  if (d.visualStylePack) return d.visualStylePack;
  if (d.outlineMd?.trim()) {
    return parseVisualStylePackFromOutline(d.outlineMd) ?? null;
  }
  return null;
}

/** 从脚本 hub 读取全片视觉 pack（节点 data 优先，否则解析 outline） */
export function readHubVisualStylePack(
  hubNodeId: string | undefined,
  nodes: { id: string; data?: unknown }[],
): StoryProVisualStylePack | null {
  if (!hubNodeId?.trim()) return null;
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (!hub) return null;
  return resolveHubVisualStylePackFromHubData(
    hub.data as {
      visualStylePack?: StoryProVisualStylePack;
      outlineMd?: string;
    },
  );
}
