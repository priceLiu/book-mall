import type { CanvasFlowNode } from "./types";
import {
  STORY_THEME_SYSTEM_PROMPT_DEFAULT,
  STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1,
  STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER,
} from "./story-prompts";

const LEGACY_THEME_DEFAULT =
  "故事创意：例如「赛博朋克城市里，外卖员发现 AI 有了自我意识…」";

function extractThemeFromLegacy(theme: string): string | null {
  const m = theme.match(/「([^」]+)」/);
  if (m?.[1]?.trim()) return m[1].trim();
  const stripped = theme
    .replace(/^故事创意：例如/, "")
    .replace(/…$/, "")
    .trim();
  return stripped || null;
}

/** 将旧 `theme` 字段迁移为 `systemPrompt`（加载 / 保存前 in-memory）。 */
export function migrateStoryComicStarterNode(n: CanvasFlowNode): CanvasFlowNode {
  if (n.type !== "story-comic-starter") return n;
  const data = (n.data ?? {}) as Record<string, unknown>;
  if (typeof data.systemPrompt === "string" && data.systemPrompt.trim()) {
    return n;
  }
  const theme = String(data.theme ?? "").trim();
  let systemPrompt = STORY_THEME_SYSTEM_PROMPT_DEFAULT;
  if (theme && theme !== LEGACY_THEME_DEFAULT) {
    const subject = extractThemeFromLegacy(theme);
    if (subject) {
      systemPrompt = STORY_THEME_SYSTEM_PROMPT_TEMPLATE_1.replace(
        STORY_THEME_SYSTEM_PROMPT_THEME_PLACEHOLDER,
        subject,
      );
    }
  }
  return {
    ...n,
    data: {
      ...data,
      systemPrompt,
      systemPromptTemplateId: "full-pack-detailed",
      theme: "",
    },
  } as CanvasFlowNode;
}
