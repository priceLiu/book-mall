import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { parseReferencedIds } from "./dock-mention-parse";
import { stripMentionTokensFromPrompt } from "./strip-dock-mentions";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMentionTokenInPrompt(
  prompt: string,
  refId: string,
  replacement: string,
): string {
  if (!refId) return prompt;
  return prompt.replace(
    new RegExp(`@<${escapeRegExp(refId)}>`, "g"),
    replacement,
  );
}

function parseDockImageRefIndex(link: Pro2DockUpstreamLink): number | null {
  const m = /^图片\s*(\d+)$/i.exec(link.label.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 与 resolveSbv1VideoEngineInputs 提交顺序对齐：按 upstream 中图片 chip 编号 */
function buildDockImageIndexById(
  upstreamLinks: Pro2DockUpstreamLink[],
): Map<string, number> {
  const map = new Map<string, number>();
  let fallback = 0;
  for (const link of upstreamLinks) {
    if (link.kind !== "image") continue;
    const fromLabel = parseDockImageRefIndex(link);
    if (fromLabel != null) {
      map.set(link.id, fromLabel);
      fallback = Math.max(fallback, fromLabel);
      continue;
    }
    fallback += 1;
    map.set(link.id, fallback);
  }
  return map;
}

function bailianR2vImageRefToken(index: number, modelKey?: string): string {
  if (modelKey?.trim() === "wan2.7-r2v") return `图${index}`;
  return `[Image ${index}]`;
}

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
    if (link.kind === "image" || link.kind === "video") continue;
    const text = link.previewMd?.trim();
    if (text) extraText.push(text);
  }

  return { prompt: cleaned.replace(/\s{2,}/g, " ").trim(), extraText };
}

/**
 * sbv1 视频合成 · 提交前展开 @：
 * - 图片 → 百炼 R2V 指代（HappyHorse 等用 [Image N]；万相 2.7 用 图N）
 * - 文本/大纲 → 内联替换为完整正文（保留「请根据 @文本1 生成」语义）
 */
export function resolveSbv1VideoEngineRunPrompt(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  opts?: { modelKey?: string },
): string {
  const mentioned = parseReferencedIds(prompt);
  if (!mentioned.length) return prompt.trim();

  const byId = new Map(upstreamLinks.map((l) => [l.id, l] as const));
  const imageIndexById = buildDockImageIndexById(upstreamLinks);
  let result = prompt;

  for (const id of mentioned) {
    const link = byId.get(id);
    if (!link) continue;

    if (link.kind === "image") {
      const idx = imageIndexById.get(id);
      if (idx != null) {
        result = replaceMentionTokenInPrompt(
          result,
          id,
          bailianR2vImageRefToken(idx, opts?.modelKey),
        );
      } else {
        result = stripMentionTokensFromPrompt(result, [id]);
      }
      continue;
    }

    if (link.kind === "video") {
      // 成片经 in_motion_video 边传入；@ 仅作语义指代，去掉 token 保留周围文案
      result = stripMentionTokensFromPrompt(result, [id]);
      continue;
    }

    const text = link.previewMd?.trim();
    if (!text) {
      result = stripMentionTokensFromPrompt(result, [id]);
      continue;
    }
    result = replaceMentionTokenInPrompt(result, id, text);
  }

  return result.replace(/\s{2,}/g, " ").trim();
}
