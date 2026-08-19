/**
 * Pro2 制作包 · 中文提示词规范化（反向词 / 去除英文标签）
 * book-mall/lib/canvas/pro2-chinese-prompt-normalize.ts 须保持同步
 */
import type {
  Pro2ProductionScript,
  Pro2ProductionScriptPatch,
} from "./data/pro2-production-script-schema";

/** 去掉 `<<<scene_A>>>` / `<<<prop_computer>>>` 等锚点占位符（保留可读名称） */
export function stripPro2AnchorPlaceholders(text: string): string {
  return text
    .replace(/`?\s*<<<[^>]+>>>\s*`?\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 从占位符或 id 提取 slug：`<<<prop_computer>>>` → `prop-computer` */
export function pro2PlaceholderSlug(raw: string): string {
  const m = String(raw ?? "").match(/<<<([^>]+)>>>/);
  const slug = (m?.[1] ?? raw).trim();
  return slug.replace(/_/g, "-");
}

function normalizePro2DisplayText(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return text;
  return stripPro2AnchorPlaceholders(t) || t;
}

function normalizePro2PropId(raw: string): string {
  return pro2PlaceholderSlug(raw);
}

/** 道具 id / 占位符 → 中文道具名（回落 strip 后的原文） */
export function resolvePro2PropIdToName(
  idOrPlaceholder: string,
  script: Pro2ProductionScript,
): string {
  const raw = String(idOrPlaceholder ?? "").trim();
  if (!raw || raw === "—") return raw;
  const normalizedId = normalizePro2PropId(raw);
  const stripped = stripPro2AnchorPlaceholders(raw);
  const prop = script.props?.find(
    (p) =>
      p.id === raw ||
      p.id === normalizedId ||
      p.id === raw.replace(/_/g, "-") ||
      p.name === raw ||
      p.name === stripped,
  );
  if (prop?.name?.trim()) return stripPro2AnchorPlaceholders(prop.name);
  if (stripped) return stripped;
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  return raw;
}

function resolvePropIdsAgainstCatalog(
  propIds: string[] | undefined,
  props: Pro2ProductionScript["props"],
): string[] | undefined {
  if (!propIds?.length) return propIds;
  return propIds.map((id) => {
    const raw = String(id).trim();
    if (!raw) return raw;
    const slug = normalizePro2PropId(raw);
    const byId = props?.find(
      (p) => p.id === raw || p.id === slug || p.id === raw.replace(/_/g, "-"),
    );
    if (byId) return byId.id;
    const stripped = stripPro2AnchorPlaceholders(raw);
    const byName = props?.find((p) => p.name === raw || p.name === stripped);
    if (byName) return byName.id;
    return slug;
  });
}

/** 分镜表「道具」列 · 逗号/顿号分隔的占位符或 id → 中文名 */
export function resolvePro2PropNamesCell(
  raw: string,
  script?: Pro2ProductionScript,
): string {
  const t = raw.trim();
  if (!t || t === "—") return t;
  const parts = t.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return t;
  if (!script?.props?.length) {
    const stripped = parts.map(stripPro2AnchorPlaceholders).filter(Boolean);
    return stripped.length ? stripped.join("、") : t;
  }
  return parts.map((p) => resolvePro2PropIdToName(p, script)).join("、");
}

/** 全剧默认反向词（中文 · 顿号分隔） */
export const PRO2_UNIVERSAL_NEGATIVE_ZH =
  "动画风、游戏CG、插画风、二次元、动漫风、水彩风、油画风、过度后期、塑料质感皮肤、平光、高饱和撞色、现代元素、不自然肤质、僵硬面部、无肤质细节、杂乱构图、水印、签名、文字叠加、模糊、低清晰度";

const EN_NEGATIVE_TERM_MAP: Record<string, string> = {
  animation: "动画风",
  "game cg": "游戏CG",
  "game-cg": "游戏CG",
  illustration: "插画风",
  anime: "动漫风",
  watercolor: "水彩风",
  "oil painting": "油画风",
  "over-processed": "过度后期",
  "over processed": "过度后期",
  "plastic skin": "塑料质感皮肤",
  "flat lighting": "平光",
  "oversaturated clash": "高饱和撞色",
  "modern elements": "现代元素",
  "unnatural skin": "不自然肤质",
  "stiff face": "僵硬面部",
  "no skin texture": "无肤质细节",
  clutter: "杂乱构图",
  watermark: "水印",
  signature: "签名",
  "text overlay": "文字叠加",
  blurry: "模糊",
  "low quality": "低清晰度",
  "low resolution": "低清晰度",
  "low-res": "低清晰度",
  cartoon: "卡通风",
  cg: "CG感",
  "3d render": "3D渲染感",
  "concept art": "概念插画风",
};

function translateEnglishNegativeTerm(term: string): string {
  const raw = term.trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  if (EN_NEGATIVE_TERM_MAP[key]) return EN_NEGATIVE_TERM_MAP[key];
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  if (/^#?[0-9a-f]{3,8}$/i.test(raw)) return "";
  if (/^[0-9]+(?:mm|k|d)$/i.test(raw)) return "";
  return "";
}

/** 去掉 [Negative: …] / [Global visual style] 等英文标签壳 */
export function stripPro2EnglishPromptTags(text: string): string {
  return text
    .replace(/\[Negative:\s*([^\]]*)\]/gi, "$1")
    .replace(/\[Global visual style\][^\n]*/gi, "")
    .trim();
}

/** 反向提示词 → 中文顿号列表（兼容旧英文 Negative 串） */
export function normalizePro2NegativePrompt(text: string): string {
  const stripped = stripPro2EnglishPromptTags(text);
  if (!stripped) return "";
  if (!/[a-zA-Z]/.test(stripped) && /[\u4e00-\u9fff]/.test(stripped)) {
    return dedupeChineseList(stripped);
  }
  const parts = stripped
    .split(/[,，、;；|/]+/)
    .map(translateEnglishNegativeTerm)
    .filter(Boolean);
  const merged = dedupeChineseList(parts.join("、"));
  return merged || PRO2_UNIVERSAL_NEGATIVE_ZH;
}

function dedupeChineseList(text: string): string {
  const items = text
    .split(/[,，、;；|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(items)].join("、");
}

/** 去掉 prompt 内英文视觉标签行（保留中文块） */
export function stripPro2EnglishVisualStyleLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/\[Global visual style\]/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ALLOW_LATIN_PATTERNS = [
  /#[0-9A-Fa-f]{3,8}\b/g,
  /<<<[^>]+>>>/g,
  /-?\d+dB/gi,
  /\b\d+(?:mm|K)\b/gi,
];

/** 是否含不应出现的英文词（4+ 字母） */
export function pro2TextHasUnwantedLatin(text: string): boolean {
  let t = text.trim();
  if (!t) return false;
  for (const re of ALLOW_LATIN_PATTERNS) {
    t = t.replace(re, " ");
  }
  t = t.replace(/\[Negative:[^\]]*\]/gi, " ");
  return /\b[a-zA-Z]{4,}\b/.test(t);
}

function normalizeOptionalPrompt(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return text;
  return stripPro2EnglishVisualStyleLines(t);
}

/** patch 落库前 · 反向词与 prompt 中文化 */
export function normalizePro2ProductionScriptPatchChinese(
  envelope: Pro2ProductionScriptPatch,
): Pro2ProductionScriptPatch {
  const patch = envelope.patch;
  if (!patch) return envelope;

  const props = patch.props?.map((p) => ({
    ...p,
    id: normalizePro2PropId(p.id),
    name: normalizePro2DisplayText(p.name) ?? p.name,
    description: normalizePro2DisplayText(p.description) ?? p.description,
  }));

  const propCatalog = props ?? patch.props;

  const scenes = patch.scenes?.map((s) => ({
    ...s,
    name: normalizePro2DisplayText(s.name) ?? s.name,
    imagePrompt: normalizeOptionalPrompt(s.imagePrompt) ?? s.imagePrompt,
    negativePrompt: s.negativePrompt?.trim()
      ? normalizePro2NegativePrompt(s.negativePrompt)
      : s.negativePrompt,
  }));

  const characters = patch.characters?.map((c) => ({
    ...c,
    name: normalizePro2DisplayText(c.name) ?? c.name,
    role: normalizePro2DisplayText(c.role) ?? c.role,
    appearance: normalizePro2DisplayText(c.appearance) ?? c.appearance,
    imagePrompt: normalizeOptionalPrompt(c.imagePrompt) ?? c.imagePrompt,
  }));

  const shots = patch.shots?.map((sh) => ({
    ...sh,
    propIds: resolvePropIdsAgainstCatalog(
      sh.propIds?.map((id) => String(id)),
      propCatalog,
    ),
    sceneDescription:
      normalizePro2DisplayText(sh.sceneDescription) ?? sh.sceneDescription,
    dialogue: normalizePro2DisplayText(sh.dialogue) ?? sh.dialogue,
    imagePrompt: normalizeOptionalPrompt(sh.imagePrompt) ?? sh.imagePrompt,
    videoPrompt: sh.videoPrompt?.trim()
      ? normalizePro2VideoPromptChinese(sh.videoPrompt)
      : sh.videoPrompt,
  }));

  const visualStyle = patch.visualStyle
    ? {
        ...patch.visualStyle,
        styleAnchor: patch.visualStyle.styleAnchor?.trim()
          ? stripPro2EnglishVisualStyleLines(patch.visualStyle.styleAnchor)
          : patch.visualStyle.styleAnchor,
      }
    : patch.visualStyle;

  return {
    ...envelope,
    patch: {
      ...patch,
      visualStyle,
      props,
      scenes,
      characters,
      shots,
    },
  };
}

/** 视频 prompt 末尾英文 Negative → 中文反向块 */
export function normalizePro2VideoPromptChinese(text: string): string {
  const negMatch = text.match(/\[Negative:\s*([^\]]+)\]/i);
  if (!negMatch) return stripPro2EnglishVisualStyleLines(text);
  const withoutTag = text.replace(/\[Negative:\s*[^\]]+\]/gi, "").trim();
  const negZh = normalizePro2NegativePrompt(negMatch[1] ?? "");
  if (!negZh) return withoutTag;
  return `${withoutTag} 【反向】${negZh}`.trim();
}

/** LLM 校验 · 列出仍含英文的字段（normalize 前调用） */
export function findPro2UnwantedEnglishFields(
  envelope: Pro2ProductionScriptPatch,
): string[] {
  const patch = envelope.patch;
  if (!patch) return [];
  const issues: string[] = [];

  patch.scenes?.forEach((s, i) => {
    if (s.negativePrompt?.trim()) {
      if (/\[Negative:/i.test(s.negativePrompt)) {
        issues.push(
          `scenes[${i}].negativePrompt 须写中文反向词（顿号分隔），禁止 [Negative: …] 英文`,
        );
      } else if (pro2TextHasUnwantedLatin(s.negativePrompt)) {
        issues.push(`scenes[${i}].negativePrompt 须写中文反向词（顿号分隔）`);
      }
    }
    if (s.imagePrompt?.trim() && pro2TextHasUnwantedLatin(s.imagePrompt)) {
      issues.push(`scenes[${i}].imagePrompt 须写中文`);
    }
  });
  patch.characters?.forEach((c, i) => {
    if (c.imagePrompt?.trim() && pro2TextHasUnwantedLatin(c.imagePrompt)) {
      issues.push(`characters[${i}].imagePrompt 须写中文`);
    }
  });
  patch.shots?.forEach((sh, i) => {
    const frame =
      sh.frameImagePrompt?.trim() || sh.imagePrompt?.trim() || "";
    if (frame && pro2TextHasUnwantedLatin(frame)) {
      issues.push(`shots[${i}].frameImagePrompt 须写中文`);
    }
    if (sh.imagePrompt?.trim() && pro2TextHasUnwantedLatin(sh.imagePrompt)) {
      issues.push(`shots[${i}].imagePrompt 须写中文`);
    }
    if (sh.videoPrompt?.trim()) {
      if (/\[Negative:/i.test(sh.videoPrompt)) {
        issues.push(
          `shots[${i}].videoPrompt 须写中文（反向词用【反向】中文顿号列表）`,
        );
      } else if (pro2TextHasUnwantedLatin(sh.videoPrompt)) {
        issues.push(`shots[${i}].videoPrompt 须写中文（反向词用【反向】中文顿号列表）`);
      }
    }
  });

  return issues;
}
