/**
 * 剧本创作批次 Markdown · 服务端解析摘要（镜像客户端 script-studio-parse）
 * 用于 Gateway 任务 resultPayload 校验与日志，不替代客户端 apply。
 */
export type ScriptStudioParseMirrorSummary = {
  episodeCount: number;
  shotCount: number;
  characterTableRows: number;
  sceneTableRows: number;
  propTableRows: number;
  hasFrozenBibles: boolean;
};

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
  };
}

export function scriptStudioMirrorPayload(
  md: string,
): { scriptStudioParse: ScriptStudioParseMirrorSummary } | null {
  if (!md.trim()) return null;
  return { scriptStudioParse: summarizeScriptStudioBatchMd(md) };
}
