import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import { parseReferencedIds } from "./dock-mention-parse";
import { stripMentionTokensFromPrompt } from "./strip-dock-mentions";
import { pro2DockRefImageCatalog } from "./pro2-dock-ref-catalog";

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

/** 与 resolveDockImageUrlsForRun / pro2DockRefImageCatalog 顺序对齐；有 @ 时按 @ 出现顺序编号 */
function buildDockImageIndexById(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): Map<string, number> {
  const catalog = pro2DockRefImageCatalog(upstreamLinks, dockRefImages);
  const catalogIds = new Set(catalog.map((r) => r.id));
  const mentioned = parseReferencedIds(prompt).filter((id) => catalogIds.has(id));
  const map = new Map<string, number>();

  if (mentioned.length > 0) {
    mentioned.forEach((id, i) => map.set(id, i + 1));
    return map;
  }

  let fallback = 0;
  for (const ref of catalog) {
    const fromLabel = parseDockImageRefIndex({
      id: ref.id,
      kind: "image",
      label: ref.label ?? "",
      sourceNodeId: "",
    });
    if (fromLabel != null) {
      map.set(ref.id, fromLabel);
      fallback = Math.max(fallback, fromLabel);
      continue;
    }
    fallback += 1;
    map.set(ref.id, fallback);
  }
  return map;
}

function dockImageRefToken(
  index: number,
  opts?: { forVideo?: boolean; modelKey?: string },
): string {
  if (opts?.forVideo) {
    if (opts.modelKey?.trim() === "wan2.7-r2v") return `图${index}`;
    return `[Image ${index}]`;
  }
  return `图${index}`;
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
  opts?: { modelKey?: string; dockRefImages?: StoryRefImage[] },
): string {
  const mentioned = parseReferencedIds(prompt);
  if (!mentioned.length) return prompt.trim();

  const byId = new Map(upstreamLinks.map((l) => [l.id, l] as const));
  for (const ref of opts?.dockRefImages ?? []) {
    if (!ref.id || byId.has(ref.id)) continue;
    byId.set(ref.id, {
      id: ref.id,
      kind: "image",
      label: ref.label ?? "参考图",
      previewUrl: ref.url,
      sourceNodeId: "",
    });
  }
  const imageIndexById = buildDockImageIndexById(
    prompt,
    upstreamLinks,
    opts?.dockRefImages ?? [],
  );
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
          dockImageRefToken(idx, { forVideo: true, modelKey: opts?.modelKey }),
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

/**
 * sbv1 / Pro2 生图 · 提交前展开 @：
 * - 图片 → 图N（与 qwen / nano-banana-pro image_input 现网正确日志一致）
 * - 文本/大纲 → 内联替换为完整正文
 */
export function resolveSbv1ImageEngineRunPrompt(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): string {
  const mentioned = parseReferencedIds(prompt);
  if (!mentioned.length) return prompt.trim();

  const byId = new Map(upstreamLinks.map((l) => [l.id, l] as const));
  for (const ref of dockRefImages) {
    if (!ref.id || byId.has(ref.id)) continue;
    byId.set(ref.id, {
      id: ref.id,
      kind: "image",
      label: ref.label ?? "参考图",
      previewUrl: ref.url,
      sourceNodeId: "",
    });
  }
  const imageIndexById = buildDockImageIndexById(
    prompt,
    upstreamLinks,
    dockRefImages,
  );
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
          dockImageRefToken(idx),
        );
      } else {
        result = stripMentionTokensFromPrompt(result, [id]);
      }
      continue;
    }

    if (link.kind === "video") {
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
