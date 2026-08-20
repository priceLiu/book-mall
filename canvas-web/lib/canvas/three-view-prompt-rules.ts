/**
 * 三视图 · 写入生图 prompt 与 LLM 角色外观约束（真源）
 * book-mall/lib/canvas/three-view-prompt-rules.ts 须与本文件语义保持同步
 *
 * 组装顺序：【任务】→【硬性约束】→【角色设定】→【全局视觉风格】→ 英文补强
 */
import { formatThreeViewVisualStyleSection } from "./story-pro-visual-style-pack";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import {
  isPro2ProductionPackCharacterImagePrompt,
  isLegacyWrappedMediaPrompt,
  resolvePro2CharacterImagePromptFromRow,
  finalizePro2CharacterImageDockPrompt,
} from "./pro2-production-pack-prompt";
import { buildPro2CharacterImagePromptFromStructuredFields } from "./pro2-character-script-fields";

export { isPro2ProductionPackCharacterImagePrompt } from "./pro2-production-pack-prompt";

export const THREE_VIEW_TASK_ZH = `【任务】
生成主角的标准三视图设计稿。`;

export const THREE_VIEW_HARD_CONSTRAINTS_ZH = `【硬性约束 - 必须遵守】
- 仅生成一张图，横向构图，从左到右依次排列 **恰好三个** 全身视角：正面、侧面、背面。
- 三个视角的角色比例、服饰、发型、配色必须完全一致。
- 禁止重复视角；禁止出现分格线、边框、文字标注或网格。
- 背景为纯白色（纯白底，无渐变，无场景，无道具）。
- 角色直立站姿，双臂自然下垂于身体两侧。
- 双手不得触碰面部、遮挡面部，也不得手持或夹带任何物品。
- 只允许穿戴服饰和饰品，不得出现包袋或随身物件。
- 面部表情保持中立（无表情、无笑容），以符合标准三视图的设计规范。`;

/** 系统前缀：任务 + 硬性约束 */
export const THREE_VIEW_SYSTEM_PREFIX_ZH = `${THREE_VIEW_TASK_ZH}

${THREE_VIEW_HARD_CONSTRAINTS_ZH}`;

/** @deprecated 兼容旧引用 · 等同 THREE_VIEW_SYSTEM_PREFIX_ZH */
export const THREE_VIEW_SYSTEM_SUFFIX_ZH = THREE_VIEW_SYSTEM_PREFIX_ZH;

/** @deprecated 兼容旧引用 */
export const THREE_VIEW_IMAGE_RULES_ZH = THREE_VIEW_SYSTEM_PREFIX_ZH;

/** 一行英文补强（置于全局视觉块之后 · 仅 legacy 三视图模板使用） */
export const THREE_VIEW_TURNAROUND_REQUIREMENT_EN =
  "White-bg turnaround: front, side, back full-body only; no props in hands, no labels or panel borders.";

/** @deprecated 兼容旧引用 */
export const THREE_VIEW_ENGINE_PROMPT_INTRO_ZH =
  "生成角色标准三视图 turnaround sheet：正/侧/背各一，人设原画稿，三视角比例与服饰一致";

export const THREE_VIEW_ENGINE_PROMPT_STYLE_ZH =
  "体型、服饰、发型、配色须与角色设定一致";

/** 三视图引擎节点 · 默认占位（无角色描述时仅展示系统块） */
export const THREE_VIEW_ENGINE_PROMPT_DEFAULT = THREE_VIEW_SYSTEM_PREFIX_ZH;

/** LLM 写角色「外观 / 外貌」列时的约束（中文，嵌入 character-engine prompt） */
export const THREE_VIEW_APPEARANCE_LLM_RULE_ZH =
  "采用 bullet 列表（以「- 」开头）写角色造型：推荐字段含年龄与身份、发型、面容、服饰、配饰/肩甲、整体材质；仅写外观与穿戴服饰/饰品，不含场景、摄影画风、光线与道具；禁止性格与情节氛围；禁止背包/手提物、禁止手持或挡脸（下游三视图为白底正/侧/背 turnaround）";

const LEGACY_THREE_VIEW_IMAGE_RULES_ZH = `【视角数量 · 硬性要求】
- 整张图 **仅三个** 视角：正面、侧面、背面各 **恰好一个**，从左到右等距排列
- **禁止**重复同一视角（例如两个正面、两个侧面）；**禁止**第四个视角或多余人物副本

【构图硬性要求】
- 每个视角均为全身立绘（头顶至脚底完整入画，禁止半身或截断）
- 正面视角：人物正面朝向镜头，自然站立，双臂自然下垂或微张，视线正视前方
- 侧面、背面同为全身，站姿与正面一致
- 画面横向构图，三视图等距排列

【版式 · 禁止项】
- **禁止**每个视角外加矩形边框、分格线、箭头、标注线或 UI 装饰
- **禁止**任何文字：标题、角色名、视角标签（如 FRONT VIEW / 正面 / 侧面 / 背面）、底部说明、水印
- 角色直接呈现在纯白底上，三视图之间仅用间距区分，无框线

【无遮挡 · 硬性要求】
- 三视角中头、脸、躯干、四肢须 **完整可见**，禁止任何物体或肢体遮挡身体轮廓
- **禁止**手触脸、手扶眼镜/口罩/头发等挡脸动作；双手不得抬至面部及以上
- **禁止**手持、腋下夹持、怀抱任何物件（含书本、文件夹、道具、武器、包袋等）
- 仅允许 **穿戴在身上** 的服饰与饰品（如眼镜可戴在脸上，但不可用手去扶/调整）

【背景】纯白底（#FFFFFF），禁止场景、渐变、地面线、投影道具

【限制项】可佩戴与服装搭配的饰品、首饰、眼镜等；**禁止**背包、手提包、单肩包、斜挎包及任何背/提在身上的包袋`;

const LEGACY_THREE_VIEW_SYSTEM_SUFFIX_ZH = `【三视图 · 系统约束】
生成角色标准三视图 turnaround sheet：同一张图内从左到右并排展示 **恰好三个** 视角——正面、侧面、背面各一个，清晰人设原画稿，三视角角色比例与服饰完全一致；禁止重复视角、禁止分格边框与文字标注

体型、服饰、发型、配色、立绘规格须与角色设定一致

横排白底；正/侧/背各一全身立绘；双臂自然下垂，禁止手触脸/挡脸、禁止手持或夹持物件；仅可穿戴服饰与饰品；纯白底，禁止场景与包袋`;

const LEGACY_THREE_VIEW_TURNAROUND_REQUIREMENT_EN = `MANDATORY: Pure white background (#FFFFFF). One horizontal character turnaround reference sheet with exactly three full-body views left-to-right: front view, side view, back view — same character, identical outfit and body proportions. No scene background, no ground shadow, no props in hands, no text labels, no panel borders or split frames.`;

const LEGACY_THREE_VIEW_INTRO_LONG_ZH =
  "生成角色标准三视图 turnaround sheet：同一张图内从左到右并排展示 **恰好三个** 视角——正面、侧面、背面各一个";

function normalizePromptCompareText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function looksLikeBulletList(text: string): boolean {
  return /(?:^|\n)\s*-\s+\S/m.test(text.trim());
}

/** 散文 appearance → bullet；已是 bullet 则规范化缩进 */
function normalizeAppearanceToBullets(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (looksLikeBulletList(t)) {
    return t
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        if (/^[-*•]\s/.test(trimmed)) {
          return trimmed.startsWith("-") ? trimmed : `- ${trimmed.replace(/^[-*•]\s*/, "")}`;
        }
        return `- ${trimmed}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return t
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("- ") ? p : `- ${p}`))
    .join("\n");
}

/** 角色表 → 【角色设定：名 - 身份】bullet 块（不含性格） */
export function buildThreeViewCharacterBody(c: {
  name: string;
  role: string;
  appearance?: string;
  personality?: string;
  aiImagePrompt?: string;
}): string {
  const name = c.name?.trim() || "未命名角色";
  const role = c.role?.trim() || "角色";
  const header = `【角色设定：${name} - ${role}】`;

  const appearance = c.appearance?.trim();
  const ai = c.aiImagePrompt?.trim();
  const parts: string[] = [];

  if (appearance) {
    parts.push(normalizeAppearanceToBullets(appearance));
  }
  if (
    ai &&
    normalizePromptCompareText(ai) !== normalizePromptCompareText(appearance ?? "")
  ) {
    parts.push(normalizeAppearanceToBullets(ai));
  }

  const body = parts.filter(Boolean).join("\n");
  if (!body) return "";
  return `${header}\n${body}`;
}

export type Pro2CharacterTablePromptFields = {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
  aiImagePrompt?: string;
};

export function pro2CharacterTablePromptFingerprint(
  row: Pro2CharacterTablePromptFields,
): string {
  return [row.name, row.role, row.appearance, row.aiImagePrompt ?? ""].join(
    "\x1e",
  );
}

/** 角色表字段变更后须重建 row.prompt / 三视图 dock */
export function shouldRebuildPro2CharacterRowPrompt(
  prev: Pro2CharacterTablePromptFields & { prompt?: string },
  next: Pro2CharacterTablePromptFields,
): boolean {
  if (!prev.prompt?.trim()) return true;
  if (isLegacyWrappedMediaPrompt(prev.prompt)) return true;
  return (
    pro2CharacterTablePromptFingerprint(prev) !==
    pro2CharacterTablePromptFingerprint(next)
  );
}

/**
 * Pro2 三视图生图 prompt · 优先透传 LLM 制作包 imagePrompt，勿套 legacy 模板。
 * aiImagePrompt（Hub）> 非 legacy row.prompt（Dock 编辑）> appearance bullet + 系统块。
 */
export function resolvePro2ThreeViewRunPrompt(
  row: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
    visualStyleTag?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  const finalizeOpts = {
    visualStylePack: visualStylePack ?? null,
    visualStyleTag: row.visualStyleTag,
  };

  const passthrough = resolvePro2CharacterImagePromptFromRow(row);
  if (passthrough) {
    return finalizePro2CharacterImageDockPrompt(passthrough, finalizeOpts);
  }

  const saved = row.prompt?.trim();
  if (saved && !isLegacyWrappedMediaPrompt(saved)) {
    return finalizePro2CharacterImageDockPrompt(saved, finalizeOpts);
  }

  const structured = buildPro2CharacterImagePromptFromStructuredFields(
    {
      name: row.name,
      role: row.role,
      appearance: row.appearance,
      personality: row.personality,
      aiImagePrompt: row.aiImagePrompt,
      imagePrompt: row.prompt,
      visualStyleTag: row.visualStyleTag,
    },
    visualStylePack ?? null,
    { finalizeDock: true },
  );
  if (structured?.trim()) return structured;

  return assembleThreeViewPrompt(
    buildThreeViewCharacterBody(row),
    visualStylePack ?? null,
  );
}

/** legacy 三视图 prompt 组装（appearance bullet · 三视图 · 非制作包四视图） */
export function assembleThreeViewPrompt(
  characterBody: string,
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  const parts: string[] = [THREE_VIEW_SYSTEM_PREFIX_ZH.trim()];
  const character = stripThreeViewSystemBlocks(characterBody).trim();
  if (character) parts.push(character);
  const visual = formatThreeViewVisualStyleSection(visualStylePack ?? undefined);
  if (visual) parts.push(visual);
  parts.push(THREE_VIEW_TURNAROUND_REQUIREMENT_EN);
  return parts.join("\n\n");
}

/** 剥离系统块与全局视觉，保留【角色设定】或 legacy 角色正文 */
export function stripThreeViewSystemBlocks(text: string): string {
  let t = text.trim();
  if (!t) return "";

  const blocks = [
    LEGACY_THREE_VIEW_IMAGE_RULES_ZH,
    LEGACY_THREE_VIEW_TURNAROUND_REQUIREMENT_EN,
    LEGACY_THREE_VIEW_SYSTEM_SUFFIX_ZH,
    THREE_VIEW_SYSTEM_PREFIX_ZH,
    THREE_VIEW_HARD_CONSTRAINTS_ZH,
    THREE_VIEW_TASK_ZH,
    THREE_VIEW_TURNAROUND_REQUIREMENT_EN,
    THREE_VIEW_ENGINE_PROMPT_INTRO_ZH,
    THREE_VIEW_ENGINE_PROMPT_STYLE_ZH,
    LEGACY_THREE_VIEW_INTRO_LONG_ZH,
    "风格：二次元、写实、卡通、赛博、古风（择一或融合）",
  ];
  for (const block of blocks) {
    if (block && t.includes(block)) {
      t = t.replace(block, "").trim();
    }
  }

  t = t.replace(/【全局视觉风格[^\n]*】[\s\S]*?(?=\n\n(?:White-bg|\[Global)|$)/g, "").trim();
  t = t.replace(/【全片视觉 · 生图统一风格】[\s\S]*?(?=\n\n|$)/g, "").trim();
  t = t.replace(/\n?【全片视觉】[^\n]*/g, "").trim();
  t = t.replace(/\n?\[Global visual style\][^\n]*/g, "").trim();
  t = t.replace(/【角色外观 · 中文描述 · 须与下列一致】\n?/g, "").trim();
  t = t.replace(/【角色外观 · 英文描述 · 须与下列一致】\n?/g, "").trim();
  t = t.replace(/^角色：[^\n]*\n?/gm, "").trim();
  t = t.replace(/^定位：[^\n]*\n?/gm, "").trim();
  t = t.replace(/^外貌\/服装[^\n]*：[^\n]*\n?/gm, "").trim();
  t = t.replace(/^性格：[^\n]*\n?/gm, "").trim();
  t = t.replace(/^AI生图：[^\n]*\n?/gm, "").trim();
  t = t.replace(
    /^生成角色标准三视图 turnaround sheet：[\s\S]*?禁止分格边框与文字标注\n?/m,
    "",
  ).trim();
  t = t.replace(/^体型、服饰、发型、配色、?立绘规格须与角色设定一致\n?/m, "").trim();
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/** @deprecated 使用 assembleThreeViewPrompt */
export function appendThreeViewSystemConstraints(body: string): string {
  return assembleThreeViewPrompt(body, null);
}

function parseLegacyFlatCharacterPrompt(text: string): {
  name: string;
  role: string;
  appearance: string;
} | null {
  const t = text.trim();
  if (!t || t.includes("【角色设定：")) return null;
  const name = t.match(/^角色：([^\n]+)/m)?.[1]?.trim();
  const role = t.match(/^定位：([^\n]+)/m)?.[1]?.trim();
  const appearance = t.match(/^外貌\/服装[^\n]*：([^\n]+)/m)?.[1]?.trim();
  if (!name && !role && !appearance) return null;
  return {
    name: name || "未命名角色",
    role: role || "角色",
    appearance: appearance || "",
  };
}

/** 历史 / 用户编辑 prompt → 重排为结构化模板 */
export function normalizeThreeViewDockPrompt(
  prompt: string,
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return (
      buildPro2CharacterImagePromptFromStructuredFields(
        { name: "未命名角色", role: "角色", appearance: "" },
        visualStylePack ?? null,
        { finalizeDock: true },
      ) ?? assembleThreeViewPrompt("", visualStylePack ?? null)
    );
  }
  if (isPro2ProductionPackCharacterImagePrompt(trimmed)) {
    return finalizePro2CharacterImageDockPrompt(trimmed, {
      visualStylePack: visualStylePack ?? null,
    });
  }

  const legacy = parseLegacyFlatCharacterPrompt(trimmed);
  if (legacy) {
    return (
      buildPro2CharacterImagePromptFromStructuredFields(
        legacy,
        visualStylePack ?? null,
        { finalizeDock: true },
      ) ??
      assembleThreeViewPrompt(
        buildThreeViewCharacterBody(legacy),
        visualStylePack ?? null,
      )
    );
  }

  if (isLegacyWrappedMediaPrompt(trimmed)) {
    const stripped = stripThreeViewSystemBlocks(trimmed);
    const headerMatch = stripped.match(
      /^【角色设定：([^-\n]+)\s*-\s*([^\n]+)】\n([\s\S]*)$/m,
    );
    if (headerMatch) {
      return (
        buildPro2CharacterImagePromptFromStructuredFields(
          {
            name: headerMatch[1]!.trim(),
            role: headerMatch[2]!.trim(),
            appearance: headerMatch[3]!.trim(),
          },
          visualStylePack ?? null,
          { finalizeDock: true },
        ) ?? assembleThreeViewPrompt(stripped, visualStylePack ?? null)
      );
    }
  }

  const character = stripThreeViewSystemBlocks(trimmed);
  return assembleThreeViewPrompt(character, visualStylePack ?? null);
}

/** 辞典 · 角色描述 → 三视图生图 Dock prompt */
export function formatThreeViewPromptFromCharacterDescription(
  characterDescription: string,
  c: {
    name: string;
    role: string;
    appearance?: string;
    personality?: string;
    aiImagePrompt?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  return resolvePro2ThreeViewRunPrompt(
    {
      ...c,
      appearance: c.appearance ?? "",
      aiImagePrompt: characterDescription.trim() || c.aiImagePrompt,
    },
    visualStylePack ?? null,
  );
}

/** 定稿拆分 · 角色列每行 prompt */
export function formatCharacterRowThreeViewPrompt(
  c: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  return resolvePro2ThreeViewRunPrompt(c, visualStylePack ?? null);
}

export function resolveCharacterRowThreeViewPrompt(
  c: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  return formatCharacterRowThreeViewPrompt(c, visualStylePack ?? null);
}

/** Pro2 三视图 Dock · 制作包 imagePrompt 透传，或 legacy 组装 */
export function buildPro2ThreeViewDockPrompt(
  row: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  return resolvePro2ThreeViewRunPrompt(row, visualStylePack ?? undefined);
}

export function formatBatchThreeViewPrompt(
  c: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
  },
  visualStylePack?: StoryProVisualStylePack | null,
): string {
  return resolvePro2ThreeViewRunPrompt(c, visualStylePack ?? null);
}
