/**
 * Pro2 角色辞典 · appearance / imagePrompt 结构化字段合并
 * book-mall/lib/canvas/pro2-character-script-fields.ts 须保持语义同步
 */
import {
  finalizePro2CharacterImageDockPrompt,
  type Pro2CharacterDockVisualStyleInput,
} from "./pro2-production-pack-prompt";
import { pro2PlaceholderSlug } from "./pro2-chinese-prompt-normalize";

export type Pro2CharacterStructuredFields = {
  name?: string;
  role?: string;
  appearance?: string;
  personality?: string;
  description?: string;
  clothing?: string;
  traits?: string;
  compositionSpec?: string;
  visualStyleTag?: string;
  imagePrompt?: string;
  aiImagePrompt?: string;
};

function stripBrTags(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "\n").trim();
}

export { stripBrTags };

function appearanceHasWaimaoSection(text: string): boolean {
  return /①\s*外貌[：:]/m.test(text) || /^外貌[：:]/m.test(text);
}

function appearanceHasFuzhuangSection(text: string): boolean {
  return /②\s*服装[：:]/m.test(text) || /^服装[：:]/m.test(text);
}

function appearanceHasTezhengSection(text: string): boolean {
  return /③\s*特征[：:]/m.test(text) || /(?:^|\n)\s*特征[：:]/m.test(text);
}

function appearanceHasSignatureActionSection(text: string): boolean {
  return (
    /③\s*标志性动作[：:]/m.test(text) ||
    /(?:^|\n)\s*标志性动作[：:]/m.test(text)
  );
}

function parseNumberedAppearanceSections(text: string): {
  description?: string;
  clothing?: string;
} {
  return {
    description: text.match(/①\s*外貌[：:]\s*([^\n]+)/)?.[1]?.trim(),
    clothing: text.match(/②\s*服装[：:]\s*([^\n]+)/)?.[1]?.trim(),
  };
}

/** LLM/GFM 已在列内写好 ①②③ 三段 · 不再重组（③ 须为「特征」非「标志性动作」） */
function appearanceCellIsPrestructured(text: string): boolean {
  if (!text.trim()) return false;
  const hasW = appearanceHasWaimaoSection(text);
  const hasF = appearanceHasFuzhuangSection(text);
  const hasT = appearanceHasTezhengSection(text);
  if (appearanceHasSignatureActionSection(text)) return false;
  if (hasW && hasF && hasT) return true;
  if (hasW && hasF) return true;
  return false;
}

/** 旧式散文 · 去掉「标志性动作」（不属于视觉辞典列） */
function stripSignatureActionTail(text: string): string {
  return text
    .replace(/(?:^|[。；;\n])\s*标志性动作[：:][\s\S]*$/u, "")
    .replace(/[。；;\s]+$/u, "")
    .trim();
}

const CLOTHING_PART_RE =
  /(?:装为|身着|身穿|穿着|头戴|束发|腰系|腰佩|佩戴|穿戴|(?:现代|盛唐|古装|幼年|少年|青年|中年|老年)?(?:男装|女装|装|服饰)?为|[袍冠帔帻幞]|龙袍|玉带|紫袍|西裤|衬衫|T恤|皮鞋|官靴|官袍|长袍|西装)/;

function classifyAppearancePart(part: string): "waimao" | "fuzhuang" {
  const t = part.trim();
  if (!t) return "waimao";
  if (CLOTHING_PART_RE.test(t)) return "fuzhuang";
  return "waimao";
}

/** 旧式散文 appearance → 外貌 / 服装 子串 */
function splitLegacyProseAppearanceClothing(text: string): {
  waimao: string;
  fuzhuang: string;
} {
  const cleaned = stripSignatureActionTail(text);
  if (!cleaned) return { waimao: "", fuzhuang: "" };

  const waimaoParts: string[] = [];
  const fuzhuangParts: string[] = [];
  for (const clause of cleaned.split(/[；;]/).map((s) => s.trim()).filter(Boolean)) {
    for (const part of clause.split(/[，,]/).map((s) => s.trim()).filter(Boolean)) {
      if (classifyAppearancePart(part) === "fuzhuang") {
        fuzhuangParts.push(part);
      } else {
        waimaoParts.push(part);
      }
    }
  }
  return {
    waimao: waimaoParts.join("，"),
    fuzhuang: fuzhuangParts.join("，"),
  };
}

/** 从 imagePrompt / aiImagePrompt 回填 description · clothing · traits */
export function extractStructuredFieldsFromImagePrompt(
  imagePrompt?: string | null,
): Pick<Pro2CharacterStructuredFields, "description" | "clothing" | "traits"> {
  const t = (imagePrompt ?? "").trim();
  if (!t.includes("名称：")) return {};
  const desc = t.match(/(?:^|\n)\s*描述[：:]\s*([^\n]+)/)?.[1]?.trim();
  const clothing = t.match(/(?:^|\n)\s*服装[：:]\s*([^\n]+)/)?.[1]?.trim();
  const traits = t.match(/(?:^|\n)\s*特征[：:]\s*([^\n]+)/)?.[1]?.trim();
  return { description: desc, clothing, traits };
}

/** 从散文中提取可固定化的面部/体态特征（兜底 ≥1 项） */
function extractTraitCandidatesFromProse(text: string): string | undefined {
  const cleaned = stripSignatureActionTail(text);
  if (!cleaned) return undefined;
  const hits: string[] = [];
  const patterns = [
    /面容[^，,。；;\n]+/g,
    /目光[^，,。；;\n]+/g,
    /胡须[^，,。；;\n]+/g,
    /眼下[^，,。；;\n]+/g,
    /双颊[^，,。；;\n]+/g,
    /眉心[^，,。；;\n]+/g,
    /肤色[^，,。；;\n]+/g,
    /脸型[^，,。；;\n]+/g,
  ];
  for (const re of patterns) {
    for (const m of cleaned.matchAll(re)) {
      const hit = m[0]?.trim();
      if (hit && !hits.includes(hit)) hits.push(hit);
    }
  }
  if (!hits.length) return undefined;
  const markers = ["①", "②", "③", "④", "⑤"];
  return hits
    .slice(0, 5)
    .map((h, i) => `${markers[i] ?? "·"}${h}`)
    .join(" ");
}

function mergeCharacterStructuredFields(
  c: Pro2CharacterStructuredFields,
): Pro2CharacterStructuredFields {
  const fromPrompt = extractStructuredFieldsFromImagePrompt(
    c.imagePrompt ?? c.aiImagePrompt,
  );
  return {
    ...c,
    description: c.description?.trim() || fromPrompt.description || "",
    clothing: c.clothing?.trim() || fromPrompt.clothing || "",
    traits: c.traits?.trim() || fromPrompt.traits || "",
  };
}

/** GFM「外貌/服装/标志性动作」列 · 强制 ①外貌 ②服装 ③特征 */
export function formatPro2CharacterAppearanceCell(
  c: Pro2CharacterStructuredFields,
): string {
  const merged = mergeCharacterStructuredFields(c);
  const appearanceRaw = (merged.appearance ?? "").trim();
  const appearance = stripBrTags(appearanceRaw);

  if (appearanceCellIsPrestructured(appearance)) {
    return stripBrTags(appearance);
  }

  let desc = merged.description?.trim();
  let clothing = merged.clothing?.trim();
  let traits = merged.traits?.trim();

  if (appearance && (!desc || !clothing)) {
    const numbered = parseNumberedAppearanceSections(appearance);
    if (!desc && numbered.description) desc = numbered.description;
    if (!clothing && numbered.clothing) clothing = numbered.clothing;
  }

  if (appearance && (!desc || !clothing)) {
    const split = splitLegacyProseAppearanceClothing(appearance);
    if (!desc && split.waimao) desc = split.waimao;
    if (!clothing && split.fuzhuang) clothing = split.fuzhuang;
  }

  if (!traits && appearance) {
    traits = extractTraitCandidatesFromProse(appearance);
  }

  const parts: string[] = [];
  if (desc) parts.push(`① 外貌：${desc}`);
  else if (appearance && !clothing) {
    parts.push(`① 外貌：${stripSignatureActionTail(appearance)}`);
  } else if (appearance) {
    parts.push(`① 外貌：${stripSignatureActionTail(appearance)}`);
  }

  if (clothing) parts.push(`② 服装：${clothing}`);
  if (traits) parts.push(`③ 特征：${traits}`);

  if (parts.length >= 2) return parts.join("\n");
  if (parts.length === 1) return parts[0]!;
  return appearance || "（待补充外观）";
}

/** 从 JSON 结构化字段组装金标准 imagePrompt（缺省时兜底） */
export function buildPro2CharacterImagePromptFromStructuredFields(
  c: Pro2CharacterStructuredFields,
  visualStylePack?: Pro2CharacterDockVisualStyleInput | null,
  options?: { finalizeDock?: boolean },
): string | undefined {
  const finalizeDock = options?.finalizeDock !== false;
  const merged = mergeCharacterStructuredFields(c);
  const existing = (merged.imagePrompt ?? merged.aiImagePrompt ?? "").trim();
  if (existing.includes("名称：") && existing.includes("描述：")) {
    if (!finalizeDock) return existing;
    return finalizePro2CharacterImageDockPrompt(existing, {
      visualStylePack,
      visualStyleTag: merged.visualStyleTag,
    });
  }

  const name = merged.name?.trim();
  const role = merged.role?.trim();
  if (!name) return existing || undefined;

  const appearanceCell = formatPro2CharacterAppearanceCell(merged);
  const split = splitLegacyProseAppearanceClothing(
    merged.appearance?.trim() || appearanceCell,
  );

  const desc =
    merged.description?.trim() ||
    split.waimao ||
    (merged.appearance?.trim() && !merged.appearance.includes("\n")
      ? stripSignatureActionTail(merged.appearance.trim())
      : "");
  const clothing = merged.clothing?.trim() || split.fuzhuang || "";
  let traits = merged.traits?.trim() || "";
  if (!traits) {
    const tezhengLine = appearanceCell
      .split("\n")
      .find((line) => /③\s*特征[：:]/.test(line));
    traits = tezhengLine?.replace(/^③\s*特征[：:]\s*/, "").trim() ?? "";
  }

  const blocks = [
    `名称：${name}${role ? `，${role}` : ""}`,
    desc ? `\n描述：${desc}` : "",
    clothing ? `\n服装：${clothing}` : "",
    traits ? `\n特征：${traits}` : "",
  ].filter(Boolean);

  if (blocks.length <= 1 && !existing) return undefined;

  const core = blocks.join("\n").trim() || existing;
  if (!core) return undefined;

  let prompt = core;
  if (merged.compositionSpec?.trim() && !prompt.includes("构图规范：")) {
    prompt = `${prompt}\n\n构图规范：${merged.compositionSpec.trim()}`;
  }

  if (!finalizeDock) return prompt;

  return finalizePro2CharacterImageDockPrompt(prompt, {
    visualStylePack,
    visualStyleTag: merged.visualStyleTag,
  });
}

/** LLM JSON alias / 缺字段 · apply 前补全 */
export function enrichPro2CharacterRecordForParse(
  raw: Record<string, unknown>,
  options?: {
    visualStylePack?: import("./pro2-production-pack-prompt").Pro2CharacterDockVisualStyleInput | null;
  },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  if (!String(out.id ?? "").trim() && out.name) {
    out.id = pro2PlaceholderSlug(String(out.name));
  }
  if (!String(out.role ?? "").trim()) {
    const identity = String(out.identity ?? out.定位 ?? "").trim();
    if (identity) out.role = identity;
  }
  if (!String(out.imagePrompt ?? "").trim()) {
    const ai = String(out.aiImagePrompt ?? out.aiImagePromptEn ?? "").trim();
    if (ai) out.imagePrompt = ai;
  }

  const fields: Pro2CharacterStructuredFields = {
    name: String(out.name ?? ""),
    role: String(out.role ?? ""),
    appearance: String(out.appearance ?? ""),
    description: String(out.description ?? ""),
    clothing: String(out.clothing ?? ""),
    traits: String(out.traits ?? ""),
    compositionSpec: String(out.compositionSpec ?? ""),
    visualStyleTag: String(out.visualStyleTag ?? ""),
    imagePrompt: String(out.imagePrompt ?? ""),
    aiImagePrompt: String(out.aiImagePrompt ?? ""),
  };

  out.appearance = formatPro2CharacterAppearanceCell(fields);

  const built = buildPro2CharacterImagePromptFromStructuredFields(
    fields,
    options?.visualStylePack ?? null,
    { finalizeDock: true },
  );
  if (built) out.imagePrompt = built;
  else if (String(out.imagePrompt ?? "").trim()) {
    out.imagePrompt = finalizePro2CharacterImageDockPrompt(String(out.imagePrompt), {
      visualStylePack: options?.visualStylePack,
      visualStyleTag: fields.visualStyleTag,
    });
  }

  const merged = mergeCharacterStructuredFields({
    ...fields,
    appearance: String(out.appearance ?? ""),
  });
  if (merged.description?.trim()) out.description = merged.description;
  if (merged.clothing?.trim()) out.clothing = merged.clothing;
  if (merged.traits?.trim()) out.traits = merged.traits;

  if (!String(out.personality ?? "").trim()) out.personality = "—";

  return out;
}

/** 旧式散文 appearance · 打开 Hub / 落库后须强制转为 ①②③ */
export function characterAppearanceNeedsStructuredCoerce(
  appearance?: string | null,
): boolean {
  const a = stripBrTags(appearance ?? "");
  if (!a) return false;
  return !appearanceCellIsPrestructured(a);
}
