/**
 * 电商专业拉片 · pro2-production-script v3 解析与校验
 */
import { validatePro2ProductionScriptLlmOutput } from "@/lib/canvas/pro2-production-script-llm";
import {
  mergeProductionScriptPatch,
  type Pro2ProductionScript,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { isPro2FilmPullProductionScript } from "@/lib/canvas/pro2-shot-analysis-view";

export type FilmPullPro2ExtractResult =
  | { ok: true; script: Pro2ProductionScript }
  | { ok: false; error: string };

export function extractFilmPullPro2Analyze(text: string): FilmPullPro2ExtractResult {
  const validation = validatePro2ProductionScriptLlmOutput(text, {
    llmSection: "outline",
  });
  if (!validation.ok || !validation.patch) {
    return {
      ok: false,
      error: validation.error ?? "无法解析 pro2-production-script JSON",
    };
  }
  const envelope = validation.patch;
  if (envelope.step !== "full_pack") {
    return { ok: false, error: `拉片须 step=full_pack，当前 step=${envelope.step}` };
  }
  if (envelope.patch.meta?.source !== "film_pull") {
    return { ok: false, error: "meta.source 须为 film_pull" };
  }
  if (envelope.patch.meta?.packProfile !== "industrial") {
    return { ok: false, error: "meta.packProfile 须为 industrial" };
  }
  const script = mergeProductionScriptPatch(undefined, envelope);
  if (!isPro2FilmPullProductionScript(script)) {
    return { ok: false, error: "拉片 JSON 缺少 shots[] 或 analysis" };
  }
  return { ok: true, script };
}

export function resolveFilmPullParseErrorV3(text: string): string {
  const result = extractFilmPullPro2Analyze(text);
  if (result.ok) return "";
  return result.error;
}
