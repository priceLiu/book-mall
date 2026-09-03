/**
 * Script Studio 续批上下文 · book-mall 镜像（真源 canvas-web/lib/canvas/script-studio-json-apply.ts）
 */
import type { ScriptStudioBatchJson, ScriptStudioFrozenBiblesJson } from "./data/script-studio-batch-schema";

export function buildScriptStudioContinuationContext(args: {
  frozenBibles?: ScriptStudioFrozenBiblesJson | null;
  frozenBiblesMd?: string;
  completedCanonicalJson?: ScriptStudioBatchJson[] | null;
}): string {
  const chunks: string[] = [];
  if (args.frozenBibles) {
    chunks.push(JSON.stringify({ frozenBibles: args.frozenBibles }));
  } else if (args.frozenBiblesMd?.trim()) {
    chunks.push(
      JSON.stringify({
        frozenBiblesMd: args.frozenBiblesMd.trim().slice(0, 12_000),
      }),
    );
  }
  if (args.completedCanonicalJson?.length) {
    const compact = args.completedCanonicalJson.map((batch) => ({
      batch: batch.batch,
      validationReport: batch.validationReport?.slice(0, 2000),
      episodes: batch.episodes.map((ep) => ({
        episodeNo: ep.episodeNo,
        title: ep.title,
        module1_base: ep.module1_base,
        module2_characters: ep.module2_characters.map((c) => ({
          name: c.name,
          outfit: c.outfit,
          episodeOutfit: c.episodeOutfit,
          emotion: c.emotion,
        })),
        module3_scenes: ep.module3_scenes.map((s) => ({
          name: s.name,
          intExt: s.intExt,
          time: s.time,
        })),
        module5_outline: ep.module5_outline.slice(0, 800),
        module1_cliffhanger: ep.module1_base.cliffhanger,
      })),
    }));
    chunks.push(JSON.stringify({ completedBatches: compact }));
  }
  return chunks.join("\n\n");
}

export function parseScriptStudioCanonicalJson(
  raw: unknown,
): ScriptStudioBatchJson[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ScriptStudioBatchJson =>
        item != null && typeof item === "object" && "episodes" in item,
    );
  }
  if (typeof raw === "object" && "episodes" in (raw as object)) {
    return [raw as ScriptStudioBatchJson];
  }
  return [];
}
