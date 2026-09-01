/** 客户端围栏解析（与 book-mall ecom-film-pull-structured 一致） */

import type { FilmPullAnalyzePatch } from "@/lib/film-pull-types";

export function stripFilmPullFence(text: string): string {
  return text
    .replace(/```film-pull[\s\S]*?```/gi, "")
    .replace(/```film-pull[\s\S]*$/gi, "")
    .trim();
}

export function extractFilmPullAnalyzePatch(text: string): FilmPullAnalyzePatch | null {
  const closed = text.match(/```film-pull\s*([\s\S]*?)```/i);
  const body = closed?.[1]?.trim();
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as FilmPullAnalyzePatch;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.action !== "analyze_complete" || !Array.isArray(parsed.shots)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function toFilmPullDisplayMarkdown(fullText: string, streaming?: boolean): string {
  const patch = extractFilmPullAnalyzePatch(fullText);
  if (patch) {
    return stripFilmPullFence(fullText) || fullText.trim();
  }
  const stripped = stripFilmPullFence(fullText);
  const fenceStarted = /```film-pull/i.test(fullText);
  const fenceComplete = /```film-pull[\s\S]*?```/i.test(fullText);
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped || fullText.trim();
  }
  return stripped || fullText.trim();
}
