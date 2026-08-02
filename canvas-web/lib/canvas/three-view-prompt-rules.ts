/**
 * 三视图 · 写入生图 prompt 与 LLM 角色外观约束（真源）
 * book-mall/lib/canvas/three-view-prompt-rules.ts 须与本文件语义保持同步
 *
 * 组装顺序：角色表字段（中文）→ 三视图系统约束（末尾）→ 全片视觉（若有）
 */
import {
  appendVisualStylePackToDockPrompt,
} from "./story-pro-visual-style-pack";

/** 三视图生图系统约束（始终置于角色描述之后） */
export const THREE_VIEW_SYSTEM_SUFFIX_ZH = `【三视图 · 系统约束】
生成角色标准三视图 turnaround sheet：同一张图内从左到右并排展示 **恰好三个** 视角——正面、侧面、背面各一个，清晰人设原画稿，三视角角色比例与服饰完全一致；禁止重复视角、禁止分格边框与文字标注

体型、服饰、发型、配色、立绘规格须与角色设定一致

横排白底；正/侧/背各一全身立绘；双臂自然下垂，禁止手触脸/挡脸、禁止手持或夹持物件；仅可穿戴服饰与饰品；纯白底，禁止场景与包袋`;

/** 一行英文补强（置于中文系统约束之后） */
export const THREE_VIEW_TURNAROUND_REQUIREMENT_EN =
  "White-bg turnaround: front, side, back full-body only; no props in hands, no labels or panel borders.";

/** @deprecated 兼容旧引用 · 等同精简系统约束 */
export const THREE_VIEW_IMAGE_RULES_ZH = THREE_VIEW_SYSTEM_SUFFIX_ZH;

export const THREE_VIEW_ENGINE_PROMPT_INTRO_ZH =
  "生成角色标准三视图 turnaround sheet：正/侧/背各一，人设原画稿，三视角比例与服饰一致";

export const THREE_VIEW_ENGINE_PROMPT_STYLE_ZH =
  "体型、服饰、发型、配色须与角色设定一致";

/** 三视图引擎节点 · 默认占位（无角色描述时仅展示系统约束） */
export const THREE_VIEW_ENGINE_PROMPT_DEFAULT = THREE_VIEW_SYSTEM_SUFFIX_ZH;

/** LLM 写角色「外观 / 外貌」列时的约束（中文，嵌入 character-engine prompt） */
export const THREE_VIEW_APPEARANCE_LLM_RULE_ZH =
  "仅写角色外观与穿戴服饰/饰品；不含场景、画风与道具；禁止背包/手提物、禁止手持或挡脸动作（下游三视图为白底正/侧/背 turnaround）";

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

const LEGACY_THREE_VIEW_TURNAROUND_REQUIREMENT_EN = `MANDATORY: Pure white background (#FFFFFF). One horizontal character turnaround reference sheet with exactly three full-body views left-to-right: front view, side view, back view — same character, identical outfit and body proportions. No scene background, no ground shadow, no props in hands, no text labels, no panel borders or split frames.`;

const LEGACY_THREE_VIEW_INTRO_LONG_ZH =
  "生成角色标准三视图 turnaround sheet：同一张图内从左到右并排展示 **恰好三个** 视角——正面、侧面、背面各一个";

function normalizePromptCompareText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

/** 角色表 → Dock 正文（结构化中文字段，含外貌/服装与 AI 生图列） */
export function buildThreeViewCharacterBody(c: {
  name: string;
  role: string;
  appearance?: string;
  personality?: string;
  aiImagePrompt?: string;
}): string {
  const lines: string[] = [];
  if (c.name?.trim()) lines.push(`角色：${c.name.trim()}`);
  if (c.role?.trim()) lines.push(`定位：${c.role.trim()}`);
  const appearance = c.appearance?.trim();
  if (appearance) lines.push(`外貌/服装/标志性动作：${appearance}`);
  if (c.personality?.trim()) lines.push(`性格：${c.personality.trim()}`);
  const ai = c.aiImagePrompt?.trim();
  if (
    ai &&
    normalizePromptCompareText(ai) !== normalizePromptCompareText(appearance ?? "")
  ) {
    lines.push(`AI生图：${ai}`);
  }
  return lines.join("\n");
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
  return [
    row.name,
    row.role,
    row.appearance,
    row.personality ?? "",
    row.aiImagePrompt ?? "",
  ].join("\x1e");
}

/** 角色表字段变更后须重建 row.prompt / 三视图 dock */
export function shouldRebuildPro2CharacterRowPrompt(
  prev: Pro2CharacterTablePromptFields & { prompt?: string },
  next: Pro2CharacterTablePromptFields,
): boolean {
  if (!prev.prompt?.trim()) return true;
  return (
    pro2CharacterTablePromptFingerprint(prev) !==
    pro2CharacterTablePromptFingerprint(next)
  );
}

/** 剥离历史/旧版系统块，保留角色描述正文 */
export function stripThreeViewSystemBlocks(text: string): string {
  let t = text.trim();
  if (!t) return "";

  const blocks = [
    LEGACY_THREE_VIEW_IMAGE_RULES_ZH,
    LEGACY_THREE_VIEW_TURNAROUND_REQUIREMENT_EN,
    THREE_VIEW_SYSTEM_SUFFIX_ZH,
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

  t = t.replace(/【全片视觉 · 生图统一风格】[\s\S]*?(?=\n\n|$)/g, "").trim();
  t = t.replace(/\n?【全片视觉】[^\n]*/g, "").trim();
  t = t.replace(/\n?\[Global visual style\][^\n]*/g, "").trim();
  t = t.replace(/【角色外观 · 中文描述 · 须与下列一致】\n?/g, "").trim();
  t = t.replace(/【角色外观 · 英文描述 · 须与下列一致】\n?/g, "").trim();
  t = t.replace(
    /^生成角色标准三视图 turnaround sheet：[\s\S]*?禁止分格边框与文字标注\n?/m,
    "",
  ).trim();
  t = t.replace(/^体型、服饰、发型、配色、?立绘规格须与角色设定一致\n?/m, "").trim();
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/** 角色表正文 + 系统约束（约束在末尾） */
export function appendThreeViewSystemConstraints(body: string): string {
  const content = stripThreeViewSystemBlocks(body);
  const suffix = `${THREE_VIEW_SYSTEM_SUFFIX_ZH}\n${THREE_VIEW_TURNAROUND_REQUIREMENT_EN}`;
  if (!content) return suffix;
  if (content.includes("【三视图 · 系统约束】")) {
    const stripped = stripThreeViewSystemBlocks(content);
    if (!stripped) return suffix;
    return `${stripped}\n\n${suffix}`;
  }
  return `${content}\n\n${suffix}`;
}

/** 历史 prompt 重排为「描述在前、约束在后」 */
export function normalizeThreeViewDockPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return appendThreeViewSystemConstraints("");
  return appendThreeViewSystemConstraints(trimmed);
}

/** 辞典 · 角色描述 → 三视图生图 Dock prompt（保留结构化字段） */
export function formatThreeViewPromptFromCharacterDescription(
  characterDescription: string,
  c: {
    name: string;
    role: string;
    appearance?: string;
    personality?: string;
    aiImagePrompt?: string;
  },
): string {
  return appendThreeViewSystemConstraints(
    buildThreeViewCharacterBody({
      ...c,
      aiImagePrompt: characterDescription.trim() || c.aiImagePrompt,
    }),
  );
}

/** 定稿拆分 · 角色列每行 prompt */
export function formatCharacterRowThreeViewPrompt(c: {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
  aiImagePrompt?: string;
}): string {
  return appendThreeViewSystemConstraints(buildThreeViewCharacterBody(c));
}

/** 角色辞典 · 从表字段组装（外貌/服装 + AI 生图列均保留，系统块后置） */
export function resolveCharacterRowThreeViewPrompt(c: {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
  aiImagePrompt?: string;
}): string {
  return formatCharacterRowThreeViewPrompt(c);
}

/** Pro2 三视图 Dock · 始终以角色表字段为准，系统约束与全片视觉后置 */
export function buildPro2ThreeViewDockPrompt(
  row: {
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
    prompt?: string;
  },
  visualStylePack?: import("./story-pro-visual-style-pack").StoryProVisualStylePack | null,
): string {
  const core = appendThreeViewSystemConstraints(buildThreeViewCharacterBody(row));
  return appendVisualStylePackToDockPrompt(core, visualStylePack ?? undefined);
}

/** 大纲批量创建三视图节点 */
export function formatBatchThreeViewPrompt(c: {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
  aiImagePrompt?: string;
}): string {
  return appendThreeViewSystemConstraints(buildThreeViewCharacterBody(c));
}
