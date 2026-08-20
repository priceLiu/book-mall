/**
 * Pro2 制作包 · 生图/生视频 prompt 金标准检测与透传
 * 对齐 docs/画布提示词.md · book-mall 须保持语义同步
 *
 * LLM Pass1/Pass2 返回的制作包正文应 **原样** 写入节点 Dock / row.prompt，
 * 不再套 legacy 系统块（【任务】/ 空镜英文 / 全局视觉重复 prepend 等）。
 */

import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
} from "./data/pro2-production-pack-standard";

/** Dock 视觉风格输入（与 StoryProVisualStylePack 字段兼容） */
export type Pro2CharacterDockVisualStyleInput = {
  era?: string;
  worldBackground?: string;
  visualStyle?: string;
  styleAnchorZh?: string;
};

/** 末尾 [视觉风格：…] 标签（制作包统一格式） */
export function hasPro2ProductionPackVisualStyleTag(text: string): boolean {
  return /\[视觉风格：[^\]]+\]/.test(text.trim());
}

/** 角色 · 四视图设定图（名称 + 构图规范 + 描述/服装） */
export function isPro2ProductionPackCharacterImagePrompt(text: string): boolean {
  const t = text.trim();
  if (!t.includes("名称：")) return false;
  if (/场景设定图|四个大全景|2\s*行\s*2\s*列/.test(t)) return false;
  if (/道具六视图|2\s*行\s*3\s*列|道具多角度/.test(t)) return false;
  if (/^(特写|远景|全景|中景|近景|大特写)/.test(t) && !/^名称：/m.test(t)) {
    return false;
  }
  return (
    /角色四视图|正面面部头部特写/.test(t) ||
    (t.includes("描述：") &&
      t.includes("服装：") &&
      t.includes("特征：") &&
      t.includes("构图规范："))
  );
}

/** 场景 · 2×2 四视角空镜（名称 + 构图规范 + 前背景/氛围） */
export function isPro2ProductionPackSceneImagePrompt(text: string): boolean {
  const t = text.trim();
  if (!t.includes("名称：")) return false;
  if (!t.includes("构图规范：")) return false;
  if (isPro2ProductionPackCharacterImagePrompt(t)) return false;
  if (isPro2ProductionPackPropImagePrompt(t)) return false;
  return (
    t.includes("前背景：") ||
    t.includes("氛围：") ||
    /场景设定图|2\s*行\s*2\s*列|四等分|四个大全景/.test(t) ||
    hasPro2ProductionPackVisualStyleTag(t)
  );
}

/** 道具 · 2×3 六视图（名称 + 特征 + 构图规范） */
export function isPro2ProductionPackPropImagePrompt(text: string): boolean {
  const t = text.trim();
  if (!t.includes("名称：")) return false;
  if (!t.includes("构图规范：")) return false;
  if (/角色四视图|正面面部头部特写|场景设定图|四个大全景|前背景：/.test(t)) {
    return false;
  }
  return (
    /道具六视图|道具多角度|2\s*行\s*3\s*列|六个极正视角/.test(t) ||
    (t.includes("特征：") && /六视图|2\s*行\s*3\s*列/.test(t))
  );
}

/** Pass2 · 分镜图（单段中文 + [视觉风格：] · 非结构化资产块） */
export function isPro2ProductionPackFrameImagePrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isPro2ProductionPackCharacterImagePrompt(t)) return false;
  if (isPro2ProductionPackSceneImagePrompt(t)) return false;
  if (isPro2ProductionPackPropImagePrompt(t)) return false;
  if (hasPro2ProductionPackVisualStyleTag(t)) return true;
  if (/^(特写|远景|全景|中景|近景|大特写)/.test(t) && !/^名称：/m.test(t)) {
    return true;
  }
  return false;
}

/** Pass2 · 分镜视频（Seedance 多段模板） */
export function isPro2ProductionPackVideoPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    t.includes("出场角色：") ||
    t.includes("当前分镜的分段描述：") ||
    t.includes("参考图使用规则：") ||
    (t.includes("输出约束：") && t.includes("---"))
  );
}

/** 任一制作包金标准正文 */
export function isPro2ProductionPackMediaPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    isPro2ProductionPackCharacterImagePrompt(t) ||
    isPro2ProductionPackSceneImagePrompt(t) ||
    isPro2ProductionPackPropImagePrompt(t) ||
    isPro2ProductionPackFrameImagePrompt(t) ||
    isPro2ProductionPackVideoPrompt(t)
  );
}

/** 已保存 prompt 优先；否则从候选源中找第一个制作包正文 */
export function pickPro2ProductionPackPassthrough(
  saved: string | undefined,
  sources: (string | undefined)[],
  isPack: (text: string) => boolean,
): string | undefined {
  const savedTrim = saved?.trim();
  if (savedTrim) {
    if (isPack(savedTrim) || !isLegacyWrappedMediaPrompt(savedTrim)) {
      return savedTrim;
    }
  }
  for (const raw of sources) {
    const t = raw?.trim();
    if (t && isPack(t)) return t;
  }
  return undefined;
}

/** legacy 系统拼装痕迹（需走旧组装链，勿与制作包混用） */
export function isLegacyWrappedMediaPrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    t.includes("【任务】") ||
    t.includes("【硬性约束") ||
    t.includes("【全局视觉风格") ||
    t.includes("【全片视觉") ||
    t.includes("White-bg turnaround:") ||
    t.includes("SCENE REFERENCE — environment") ||
    t.includes("【场景空镜约束】") ||
    /^场景：/m.test(t) ||
    /^生图：/m.test(t)
  );
}

/** 从 Hub 视觉风格 / 行内 tag 生成 [视觉风格：…] */
export function buildPro2CharacterVisualStyleTag(
  pack?: Pro2CharacterDockVisualStyleInput | null,
  inlineTag?: string | null,
): string | undefined {
  const raw = inlineTag?.trim();
  if (raw) {
    const inner = raw
      .replace(/^\[视觉风格：/, "")
      .replace(/\]$/, "")
      .trim();
    return inner ? `[视觉风格：${inner}]` : undefined;
  }
  if (!pack) return undefined;
  const parts = [
    pack.era?.trim(),
    pack.worldBackground?.trim(),
    pack.visualStyle?.trim(),
    pack.styleAnchorZh?.trim(),
  ].filter(Boolean);
  const unique = [...new Set(parts)];
  if (!unique.length) return undefined;
  return `[视觉风格：${unique.join("，")}]`;
}

/** 角色 Dock · 统一「构图规范」为金标准四视图全文（补齐或替换 LLM 截断/旧三视图文案） */
export function upsertPro2CharacterFourViewCompositionSpec(text: string): string {
  const canonical = `构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}`;
  let t = text.trim();
  if (!t) return canonical;

  const styleTail = t.match(/\n*\[视觉风格：[^\]]+\]\s*$/);
  const styleTag = styleTail?.[0]?.trim();
  let body = styleTail ? t.slice(0, styleTail.index).trim() : t;

  if (/构图规范：/.test(body)) {
    body = body
      .replace(/\n?构图规范：[^\n]*(?:\n(?!\n|\[视觉风格)[^\n]*)*/u, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const merged = styleTag
    ? `${body}\n\n${canonical}\n\n${styleTag}`
    : `${body}\n\n${canonical}`;
  return merged.replace(/\n{3,}/g, "\n\n").trim();
}

/** 三视图 Dock · 补齐缺失的构图规范与 [视觉风格：]（LLM 漏写时兜底） */
export function finalizePro2CharacterImageDockPrompt(
  prompt: string,
  options?: {
    visualStylePack?: Pro2CharacterDockVisualStyleInput | null;
    visualStyleTag?: string | null;
  },
): string {
  let t = prompt.trim();
  if (!t || isLegacyWrappedMediaPrompt(t)) return t;

  t = upsertPro2CharacterFourViewCompositionSpec(t);

  if (!hasPro2ProductionPackVisualStyleTag(t)) {
    const tag = buildPro2CharacterVisualStyleTag(
      options?.visualStylePack,
      options?.visualStyleTag,
    );
    if (tag) t = `${t}\n\n${tag}`;
  }

  return t;
}

/** 场景 Dock · 统一「构图规范」为金标准 2×2 四视角全文（补齐或替换 LLM 截断/旧文案） */
export function upsertPro2SceneFourViewCompositionSpec(text: string): string {
  const canonical = `构图规范：${PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC}`;
  let t = text.trim();
  if (!t) return canonical;

  const styleTail = t.match(/\n*\[视觉风格：[^\]]+\]\s*$/);
  const styleTag = styleTail?.[0]?.trim();
  let body = styleTail ? t.slice(0, styleTail.index).trim() : t;

  if (/构图规范：/.test(body)) {
    body = body
      .replace(/\n?构图规范：[^\n]*(?:\n(?!\n|\[视觉风格)[^\n]*)*/u, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const merged = styleTag
    ? `${body}\n\n${canonical}\n\n${styleTag}`
    : `${body}\n\n${canonical}`;
  return merged.replace(/\n{3,}/g, "\n\n").trim();
}

/** 场景图 Dock · 补齐缺失的构图规范与 [视觉风格：]（LLM 漏写时兜底） */
export function finalizePro2SceneImageDockPrompt(
  prompt: string,
  options?: {
    visualStylePack?: Pro2CharacterDockVisualStyleInput | null;
    visualStyleTag?: string | null;
  },
): string {
  let t = prompt.trim();
  if (!t || isLegacyWrappedMediaPrompt(t)) return t;
  if (!t.includes("名称：")) return t;

  t = upsertPro2SceneFourViewCompositionSpec(t);

  if (!hasPro2ProductionPackVisualStyleTag(t)) {
    const tag = buildPro2CharacterVisualStyleTag(
      options?.visualStylePack,
      options?.visualStyleTag,
    );
    if (tag) t = `${t}\n\n${tag}`;
  }

  return t;
}

/** 道具 Dock · 统一「构图规范」为金标准六视图全文（补齐或替换 LLM 截断/旧文案） */
export function upsertPro2PropSixViewCompositionSpec(text: string): string {
  const canonical = `构图规范：${PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC}`;
  let t = text.trim();
  if (!t) return canonical;

  const styleTail = t.match(/\n*\[视觉风格：[^\]]+\]\s*$/);
  const styleTag = styleTail?.[0]?.trim();
  let body = styleTail ? t.slice(0, styleTail.index).trim() : t;

  if (/构图规范：/.test(body)) {
    body = body
      .replace(/\n?构图规范：[^\n]*(?:\n(?!\n|\[视觉风格)[^\n]*)*/u, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const merged = styleTag
    ? `${body}\n\n${canonical}\n\n${styleTag}`
    : `${body}\n\n${canonical}`;
  return merged.replace(/\n{3,}/g, "\n\n").trim();
}

/** 道具图 Dock · 补齐缺失的构图规范与 [视觉风格：]（LLM 漏写时兜底） */
export function finalizePro2PropImageDockPrompt(
  prompt: string,
  options?: {
    visualStylePack?: Pro2CharacterDockVisualStyleInput | null;
    visualStyleTag?: string | null;
  },
): string {
  let t = prompt.trim();
  if (!t || isLegacyWrappedMediaPrompt(t)) return t;
  if (!t.includes("名称：")) return t;

  t = upsertPro2PropSixViewCompositionSpec(t);

  if (!hasPro2ProductionPackVisualStyleTag(t)) {
    const tag = buildPro2CharacterVisualStyleTag(
      options?.visualStylePack,
      options?.visualStyleTag,
    );
    if (tag) t = `${t}\n\n${tag}`;
  }

  return t;
}

/** 角色 · 优先 Hub imagePrompt，忽略列上 stale legacy 【任务】包装 */
export function resolvePro2CharacterImagePromptFromRow(row: {
  prompt?: string;
  aiImagePrompt?: string;
}): string | undefined {
  for (const raw of [row.aiImagePrompt, row.prompt]) {
    const t = raw?.trim();
    if (!t || isLegacyWrappedMediaPrompt(t)) continue;
    if (isPro2ProductionPackCharacterImagePrompt(t)) return t;
    if (
      t.includes("名称：") &&
      t.includes("描述：") &&
      t.includes("服装：")
    ) {
      return t;
    }
  }
  return undefined;
}

export function resolvePro2SceneMediaPromptFromRow(row: {
  prompt?: string;
  imageKeywords?: string;
  description?: string;
}): string | undefined {
  const picked = pickPro2ProductionPackPassthrough(
    row.prompt,
    [row.imageKeywords, row.description],
    isPro2ProductionPackSceneImagePrompt,
  );
  if (picked) return picked;
  for (const raw of [row.imageKeywords, row.prompt, row.description]) {
    const t = raw?.trim();
    if (!t || isLegacyWrappedMediaPrompt(t)) continue;
    if (isPro2ProductionPackSceneImagePrompt(t)) return t;
    if (
      t.includes("名称：") &&
      (t.includes("描述：") ||
        t.includes("前背景：") ||
        t.includes("氛围："))
    ) {
      return t;
    }
  }
  return undefined;
}

export function resolvePro2PropMediaPromptFromRow(row: {
  prompt?: string;
  description?: string;
}): string | undefined {
  const picked = pickPro2ProductionPackPassthrough(
    row.prompt,
    [row.prompt, row.description],
    isPro2ProductionPackPropImagePrompt,
  );
  if (picked) return picked;
  for (const raw of [row.prompt, row.description]) {
    const t = raw?.trim();
    if (!t || isLegacyWrappedMediaPrompt(t)) continue;
    if (isPro2ProductionPackPropImagePrompt(t)) return t;
    if (t.includes("名称：") && (t.includes("描述：") || t.includes("特征："))) {
      return t;
    }
  }
  return undefined;
}

export function resolvePro2FrameImagePromptFromRow(row: {
  prompt?: string;
  frameImagePrompt?: string;
  aiImagePrompt?: string;
}): string | undefined {
  return pickPro2ProductionPackPassthrough(
    row.prompt,
    [row.frameImagePrompt, row.aiImagePrompt, row.prompt],
    isPro2ProductionPackFrameImagePrompt,
  );
}

export function resolvePro2VideoPromptFromRow(row: {
  videoPrompt?: string;
  prompt?: string;
}): string | undefined {
  return pickPro2ProductionPackPassthrough(
    row.videoPrompt,
    [row.videoPrompt, row.prompt],
    isPro2ProductionPackVideoPrompt,
  );
}

/** 音效 / 环境音 · 透传描述（无 legacy 包装） */
export function resolvePro2AudioMediaPromptFromRow(row: {
  prompt?: string;
  description?: string;
  name?: string;
}): string {
  return (
    row.prompt?.trim() ||
    row.description?.trim() ||
    row.name?.trim() ||
    ""
  );
}
