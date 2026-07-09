import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { parseReferencedIds } from "./dock-mention-parse";
import { stripMentionTokensFromPrompt } from "./strip-dock-mentions";

/** 生图/视频 Dock 提交前：剥掉 @ 图片 token，文本类 @ 展开为附加文案 */
export function resolveDockRunPrompt(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
): { prompt: string; extraText: string[] } {
  const mentioned = parseReferencedIds(prompt);
  if (!mentioned.length) {
    return { prompt: prompt.trim(), extraText: [] };
  }

  const byId = new Map(upstreamLinks.map((l) => [l.id, l] as const));
  let cleaned = prompt;
  const extraText: string[] = [];

  for (const id of mentioned) {
    const link = byId.get(id);
    if (!link) continue;
    cleaned = stripMentionTokensFromPrompt(cleaned, [id]);
    if (link.kind === "image") continue;
    const text = link.previewMd?.trim();
    if (text) extraText.push(text);
  }

  return { prompt: cleaned.replace(/\s{2,}/g, " ").trim(), extraText };
}
