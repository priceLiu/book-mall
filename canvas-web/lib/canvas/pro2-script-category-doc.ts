import { PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD } from "./data/pro2-gu-feng-category-doc-source";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { StoryRefImage } from "./story-ref-image";

/** 顶栏「提示词」chip · 可切换预览来源 */
export type Pro2ScriptPromptViewId = "category-doc" | "upstream-outline";

export type Pro2ScriptPromptSource = {
  id: Pro2ScriptPromptViewId;
  label: string;
  body: string;
  readOnly: boolean;
  upstreamLinkId?: string;
};

/** 旧版 Dock 占位 · 已迁移至顶栏 chip */
const LEGACY_PRO2_SCRIPT_DOCK_DOC_RE =
  /^@docs\/古风(?:田|甜)宠短剧\.md\s*$/;

/** 顶栏类别参考 · 显示标题 */
export const PRO2_GU_FENG_CATEGORY_DOC_TITLE = "古风甜宠短剧";

/** 与 docs/古风田宠短剧.md 同步的内嵌默认正文 */
export const PRO2_GU_FENG_CATEGORY_DOC_DEFAULT = PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD;

export function isPro2CustomPromptCategory(
  categoryId: Pro2ScriptCategoryId | undefined,
): boolean {
  return categoryId === "custom-prompt";
}

export function defaultPro2ScriptCategoryDocTitle(
  categoryId: Pro2ScriptCategoryId | undefined,
): string | undefined {
  if (categoryId === "gu-feng-tian-chong") return PRO2_GU_FENG_CATEGORY_DOC_TITLE;
  return undefined;
}

export function defaultPro2ScriptCategoryDocBody(
  categoryId: Pro2ScriptCategoryId | undefined,
): string | undefined {
  if (categoryId === "gu-feng-tian-chong") return PRO2_GU_FENG_CATEGORY_DOC_DEFAULT;
  return undefined;
}

/** hub 上当前生效的类别参考（用户编辑优先，否则 docs 内嵌默认） */
export function resolvePro2ScriptCategoryDocBody(
  hubData: Pick<
    StoryProScriptHubNodeData,
    "scriptCategoryId" | "scriptCategoryDocBody"
  > | undefined,
): string {
  if (isPro2CustomPromptCategory(hubData?.scriptCategoryId)) return "";
  const draft = hubData?.scriptCategoryDocBody?.trim();
  if (draft) return draft;
  return defaultPro2ScriptCategoryDocBody(hubData?.scriptCategoryId)?.trim() ?? "";
}

export function resolvePro2ScriptCategoryDocTitle(
  hubData: Pick<
    StoryProScriptHubNodeData,
    "scriptCategoryId" | "scriptCategoryDocTitle" | "scriptCategoryLabel"
  > | undefined,
): string {
  return (
    hubData?.scriptCategoryDocTitle?.trim() ||
    defaultPro2ScriptCategoryDocTitle(hubData?.scriptCategoryId) ||
    hubData?.scriptCategoryLabel?.trim() ||
    "剧本类别参考"
  );
}

export function shouldShowPro2ScriptCategoryDocChip(
  hubData: Pick<StoryProScriptHubNodeData, "scriptCategoryId"> | undefined,
): boolean {
  return hubData?.scriptCategoryId === "gu-feng-tian-chong";
}

/** 脚本 Dock 顶栏右侧 · 提示词模板 chip 始终展示 */
export function shouldShowPro2ScriptPromptTemplateChip(): boolean {
  return true;
}

/** 清除旧版 `@docs/古风…` Dock 占位（已改为顶栏 chip） */
export function stripLegacyPro2ScriptDockInput(input: string | undefined): string {
  const raw = input ?? "";
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (LEGACY_PRO2_SCRIPT_DOCK_DOC_RE.test(trimmed)) return "";
  return raw;
}

/** 顶栏「提示词」chip 可切换的来源（上游大纲 + 类别参考） */
export function resolvePro2ScriptPromptSources(
  hubData: StoryProScriptHubNodeData | undefined,
  upstreamLinks: Pro2DockUpstreamLink[],
): Pro2ScriptPromptSource[] {
  const sources: Pro2ScriptPromptSource[] = [];
  const outlineLink = upstreamLinks.find((l) => l.kind === "outline");
  if (outlineLink) {
    sources.push({
      id: "upstream-outline",
      label: outlineLink.label,
      body: outlineLink.previewMd ?? "",
      readOnly: true,
      upstreamLinkId: outlineLink.id,
    });
  }
  const body = resolvePro2ScriptCategoryDocBody(hubData);
  if (shouldShowPro2ScriptCategoryDocChip(hubData) && body) {
    sources.push({
      id: "category-doc",
      label: resolvePro2ScriptCategoryDocTitle(hubData),
      body,
      readOnly: false,
    });
  }
  return sources;
}

export function resolveActivePro2ScriptPromptSource(
  hubData: StoryProScriptHubNodeData | undefined,
  upstreamLinks: Pro2DockUpstreamLink[],
): Pro2ScriptPromptSource | undefined {
  const sources = resolvePro2ScriptPromptSources(hubData, upstreamLinks);
  if (!sources.length) return undefined;
  const preferred = hubData?.scriptPromptViewId;
  if (preferred) {
    const hit = sources.find((s) => s.id === preferred);
    if (hit) return hit;
  }
  return sources.find((s) => s.id === "category-doc") ?? sources[0];
}

/** Dock 顶栏连续角标：上游 N 个 → 提示词 chip 为 N+1 */
export function pro2ScriptPromptChipBadgeIndex(upstreamCount: number): number {
  return upstreamCount + 1;
}

/** 参考图角标起始序号（上游 + 提示词模板 chip 之后） */
export function pro2ScriptRefImageBadgeOffset(
  upstreamCount: number,
  hasPromptChip = true,
): number {
  return upstreamCount + (hasPromptChip ? 1 : 0);
}

/** 合并 hub 段 system prompt + 故事大纲/主题 + 类别参考 / 自编提示词 + Dock 补充 + 参考图 */
export function mergePro2ScriptGenerationPrompt(
  base: string,
  dockInput: string,
  refs: StoryRefImage[],
  options?: {
    categoryDoc?: string;
    /** 角色/场景/分镜段不必重复嵌入整份类别参考（减 token + 降超时风险） */
    includeCategoryDoc?: boolean;
    scriptCategoryId?: Pro2ScriptCategoryId;
    outlineMd?: string;
    themeInput?: string;
  },
): string {
  const parts = [base.trim()];
  const extra = dockInput.trim();
  const categoryId = options?.scriptCategoryId;
  const includeCategoryDoc = options?.includeCategoryDoc !== false;
  const doc = includeCategoryDoc ? options?.categoryDoc?.trim() : "";
  const outline = options?.outlineMd?.trim();
  const theme = options?.themeInput?.trim();

  if (outline) {
    parts.push(`## 故事大纲\n${outline}`);
  } else if (theme) {
    parts.push(`## 故事主题\n${theme}`);
  }

  if (isPro2CustomPromptCategory(categoryId)) {
    if (extra) {
      parts.push(
        `## 用户自编剧本提示词（优先遵循；缺省章节由系统按 GFM 制作包自动补全输出）\n${extra}`,
      );
    }
  } else {
    if (doc) parts.push(`## 剧本类别参考\n${doc}`);
    if (extra) parts.push(`## 用户补充\n${extra}`);
  }

  const refLines = refs
    .filter((r) => r.url && /^https?:\/\//.test(r.url))
    .map((r) => `- ${r.label}: ${r.url}`);
  if (refLines.length) {
    parts.push(`## 参考图\n${refLines.join("\n")}`);
  }
  return parts.join("\n\n");
}
