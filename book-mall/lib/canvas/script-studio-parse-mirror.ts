/**
 * 剧本创作批次 · 服务端解析摘要（镜像客户端 script-studio-parse / JSON apply）
 * 用于 Gateway 任务 resultPayload 校验与日志，不替代客户端 apply。
 */
import type { ScriptStudioBatchJson } from "./data/script-studio-batch-schema";
import { validateScriptStudioBatchLlmOutput } from "./script-studio-llm";

export type ScriptStudioParseMirrorSummary = {
  episodeCount: number;
  shotCount: number;
  characterTableRows: number;
  sceneTableRows: number;
  propTableRows: number;
  hasFrozenBibles: boolean;
  format: "json" | "markdown";
};

export function summarizeScriptStudioBatchJson(
  batch: ScriptStudioBatchJson,
): ScriptStudioParseMirrorSummary {
  let shotCount = 0;
  let characterRows = 0;
  let sceneRows = 0;
  let propRows = 0;
  for (const ep of batch.episodes) {
    shotCount += ep.module7_storyboard.length;
    characterRows += ep.module2_characters.length;
    sceneRows += ep.module3_scenes.length;
    propRows += ep.module4_props.length;
  }
  return {
    episodeCount: batch.episodes.length,
    shotCount,
    characterTableRows: characterRows,
    sceneTableRows: sceneRows,
    propTableRows: propRows,
    hasFrozenBibles: Boolean(batch.frozenBibles?.worldview?.trim()),
    format: "json",
  };
}

export function summarizeScriptStudioBatchMd(md: string): ScriptStudioParseMirrorSummary {
  const raw = md.trim();
  const episodeMatches = raw.match(/^#\s*第\s*\d+\s*集/gm) ?? [];
  const shotMatches = raw.match(/^###\s*镜\s*\d+/gm) ?? [];
  const charRows = raw.match(/^\|\s*[^|]+\|\s*[^|]+\|/gm)?.length ?? 0;
  const hasFrozen =
    /世界观|人物关系|场景视觉辞典|道具清单/.test(raw.slice(0, 8000)) &&
    episodeMatches.length > 0 &&
    raw.search(/^#\s*第\s*\d+\s*集/m) > 0;

  return {
    episodeCount: episodeMatches.length,
    shotCount: shotMatches.length,
    characterTableRows: charRows,
    sceneTableRows: (raw.match(/场景视觉辞典/g) ?? []).length,
    propTableRows: (raw.match(/道具清单/g) ?? []).length,
    hasFrozenBibles: hasFrozen,
    format: "markdown",
  };
}

export function scriptStudioMirrorPayload(
  output: string,
  batch?: ScriptStudioBatchJson | null,
): { scriptStudioParse: ScriptStudioParseMirrorSummary } | null {
  if (batch) {
    return { scriptStudioParse: summarizeScriptStudioBatchJson(batch) };
  }
  const validation = validateScriptStudioBatchLlmOutput(output);
  if (validation.ok && validation.batch) {
    return { scriptStudioParse: summarizeScriptStudioBatchJson(validation.batch) };
  }
  if (!output.trim()) return null;
  if (/```script-studio-batch/i.test(output) || output.trim().startsWith("{")) {
    return {
      scriptStudioParse: {
        episodeCount: 0,
        shotCount: 0,
        characterTableRows: 0,
        sceneTableRows: 0,
        propTableRows: 0,
        hasFrozenBibles: false,
        format: "json",
      },
    };
  }
  return { scriptStudioParse: summarizeScriptStudioBatchMd(output) };
}
