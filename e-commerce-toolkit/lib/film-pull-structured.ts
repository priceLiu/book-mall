/** 客户端围栏解析（与 book-mall ecom-film-pull-structured 一致；展示用宽松兜底） */

import type { FilmPullAnalyzePatch } from "@/lib/film-pull-types";
import { resolveFilmPullAnalyzePatchForDisplay } from "@/lib/film-pull-v3-display";

export { resolveFilmPullAnalyzePatchForDisplay };

function coerceDisplayText(value: unknown, fallback = "无"): string {
  if (typeof value === "string") {
    const t = value.trim();
    return t || fallback;
  }
  if (value == null || value === false) return fallback;
  return String(value).trim() || fallback;
}

function normalizeAnalyzePatchForDisplay(raw: FilmPullAnalyzePatch): FilmPullAnalyzePatch {
  const meta = raw.meta ?? ({} as FilmPullAnalyzePatch["meta"]);
  const totalDurationSec =
    typeof meta.totalDurationSec === "number" && Number.isFinite(meta.totalDurationSec)
      ? meta.totalDurationSec
      : 0;

  return {
    ...raw,
    shootingPrep: {
      venue: coerceDisplayText(raw.shootingPrep?.venue),
      costume: coerceDisplayText(raw.shootingPrep?.costume),
      props: coerceDisplayText(raw.shootingPrep?.props),
      equipment: coerceDisplayText(raw.shootingPrep?.equipment),
    },
    narrativeLogic: coerceDisplayText(raw.narrativeLogic),
    beatPoints: coerceDisplayText(raw.beatPoints),
    replicableShootingScript: coerceDisplayText(raw.replicableShootingScript),
    meta: {
      totalDurationSec,
      narrativeMainLine: coerceDisplayText(meta.narrativeMainLine),
      editRhythmCurve: coerceDisplayText(meta.editRhythmCurve),
      artStyle: coerceDisplayText(meta.artStyle),
      audioDesignLogic: coerceDisplayText(meta.audioDesignLogic),
      shotSequenceLogic: coerceDisplayText(meta.shotSequenceLogic),
      cameraLanguageSummary: coerceDisplayText(meta.cameraLanguageSummary),
    },
    shots: Array.isArray(raw.shots) ? raw.shots : [],
  };
}

export function stripFilmPullFence(text: string): string {
  return text
    .replace(/```film-pull[\s\S]*?```/gi, "")
    .replace(/```film-pull[\s\S]*$/gi, "")
    .trim();
}

export function extractFilmPullAnalyzePatch(text: string): FilmPullAnalyzePatch | null {
  const pro2Closed = text.match(/```pro2-production-script\s*([\s\S]*?)```/i);
  const pro2Body = pro2Closed?.[1]?.trim();
  if (pro2Body) {
    try {
      const envelope = JSON.parse(pro2Body) as {
        patch?: unknown;
        schemaVersion?: number;
      };
      const patch = envelope.patch ?? envelope;
      if (patch && typeof patch === "object") {
        const wrapped = {
          schemaVersion: 3 as const,
          ...(patch as Record<string, unknown>),
          meta: {
            ...((patch as { meta?: Record<string, unknown> }).meta ?? {}),
            source: "film_pull",
          },
        };
        const display = resolveFilmPullAnalyzePatchForDisplay(wrapped);
        if (display) return display;
      }
    } catch {
      /* fall through */
    }
  }

  const closed = text.match(/```film-pull\s*([\s\S]*?)```/i);
  const body = closed?.[1]?.trim();
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as FilmPullAnalyzePatch;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.action !== "analyze_complete" || !Array.isArray(parsed.shots)) return null;
    return normalizeAnalyzePatchForDisplay(parsed);
  } catch {
    return null;
  }
}

export function toFilmPullDisplayMarkdown(fullText: string, streaming?: boolean): string {
  const patch = extractFilmPullAnalyzePatch(fullText);
  // 结构化结果由 FilmPullResultPanel 渲染；此处仅作流式/失败兜底
  if (patch) return "";
  const stripped = stripFilmPullFence(fullText);
  const fenceStarted = /```film-pull/i.test(fullText);
  const fenceComplete = /```film-pull[\s\S]*?```/i.test(fullText);
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped.trim() ? stripped : "正在生成结构化 JSON…";
  }
  return stripped || fullText.trim();
}
