/**
 * 工业化剧本批次生成结果 → hub 内嵌 rows（不自动 spawn 列节点 / 连线）
 */
import {
  aggregateScriptStudioJsonBatchRows,
  buildScriptStudioContinuationContext,
  extractScriptStudioBatchRaw,
  isScriptStudioJsonOutput,
  parseScriptStudioCanonicalJson,
  renderFrozenBiblesMarkdown,
  renderScriptStudioBatchMarkdown,
} from "./script-studio-json-apply";
import { SCRIPT_STUDIO_FORMAT_JSON_V1 } from "./data/script-studio-batch-schema";
import { extractScriptStudioFrozenBiblesMd } from "./script-studio-frozen-bibles";
import { parseScriptStudioBatch } from "./script-studio-parse";
import { syncScriptStudioEpisodeToProRows } from "./script-studio-column-sync";
import { dedupeProSceneRows } from "./story-pro-column-sync";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
  StoryProMoodRow,
  StoryProAudioRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import type { CanvasFlowNode, CanvasGraph } from "./types";

const INLINE_MD_LIMIT = 32_000;

function mergeSceneRows(
  existing: StoryProSceneRow[],
  incoming: StoryProSceneRow[],
  hubId: string,
): StoryProSceneRow[] {
  return dedupeProSceneRows([...existing, ...incoming], hubId);
}

function mergeRowsByKey<T extends { key: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((r) => [r.key, r]));
  for (const row of incoming) {
    map.set(row.key, { ...map.get(row.key), ...row });
  }
  return Array.from(map.values());
}

function mergeFrameRows(
  existing: StoryProFrameRow[],
  incoming: StoryProFrameRow[],
): StoryProFrameRow[] {
  const merged = mergeRowsByKey(existing, incoming);
  return merged.sort((a, b) => a.frameIndex - b.frameIndex);
}

function attachPropRefsToFrames(
  frames: StoryProFrameRow[],
  props: StoryProPropRow[],
): StoryProFrameRow[] {
  if (!props.length) return frames;
  return frames.map((f) => {
    const text = `${f.description ?? ""} ${f.dialogue ?? ""}`;
    const refs = props
      .filter((p) => p.name.trim() && text.includes(p.name.trim()))
      .map((p) => p.key);
    if (!refs.length) return f;
    return {
      ...f,
      propRefIds: [...new Set([...(f.propRefIds ?? []), ...refs])],
    };
  });
}

type AggregatedSync = {
  characters: StoryProCharacterRow[];
  scenes: StoryProSceneRow[];
  props: StoryProPropRow[];
  frames: StoryProFrameRow[];
  moods: StoryProMoodRow[];
  audios: StoryProAudioRow[];
};

function aggregateBatchRowsFromMd(batchMd: string, hubId: string): AggregatedSync {
  const batch = parseScriptStudioBatch(batchMd);
  const out: AggregatedSync = {
    characters: [],
    scenes: [],
    props: [],
    frames: [],
    moods: [],
    audios: [],
  };
  for (const episode of batch.episodes) {
    const sync = syncScriptStudioEpisodeToProRows(episode, hubId);
    out.characters = mergeRowsByKey(out.characters, sync.characters);
    out.scenes = mergeSceneRows(out.scenes, sync.scenes, hubId);
    out.props = mergeRowsByKey(out.props, sync.props);
    out.frames = mergeFrameRows(out.frames, sync.frames);
    out.moods = mergeRowsByKey(out.moods, sync.moods);
    out.audios = mergeRowsByKey(out.audios, sync.audios);
  }
  return out;
}

function maybeDeferLargeMd(
  nodeId: string,
  fieldInline: string,
  fieldOss: string,
  md: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  ossFileName = "script-studio-bibles.md",
): void {
  if (md.length <= INLINE_MD_LIMIT) {
    updateNodeData(nodeId, { [fieldInline]: md, [fieldOss]: "" });
    return;
  }
  updateNodeData(nodeId, {
    [fieldInline]: `${md.slice(0, INLINE_MD_LIMIT)}\n\n…（正文已截断，完整内容见 OSS）`,
  });
  void import("./script-studio-oss-upload").then(({ uploadScriptStudioTextToOss }) =>
    uploadScriptStudioTextToOss(md, ossFileName).then((url) => {
      if (url) updateNodeData(nodeId, { [fieldOss]: url });
    }),
  );
}

type ScriptStudioRunFields = {
  scriptStudioMode?: boolean;
  scriptStudioFormat?: string;
  scriptStudioBatchIndex?: number;
  scriptStudioCompletedBatchesMd?: string;
  scriptStudioFrozenBiblesMd?: string;
  scriptStudioCanonicalJson?: unknown;
  scriptStudioSystem?: "original" | "adaptation";
  scriptStudioTotalEpisodes?: number;
  workspaceIds?: { scriptHubId?: string };
};

function resolveHubId(
  runNode: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): string | null {
  if (runNode.type === "story-pro2-script-hub") return runNode.id;
  const ws = (runNode.data as ScriptStudioRunFields).workspaceIds;
  if (ws?.scriptHubId) return ws.scriptHubId;
  const linked = allNodes.find(
    (n) =>
      n.type === "story-pro2-script-hub" &&
      (n.data as StoryProScriptHubNodeData).scriptStudioMode,
  );
  return linked?.id ?? null;
}

function readRunFields(node: CanvasFlowNode): ScriptStudioRunFields {
  return node.data as ScriptStudioRunFields & StoryProStarterNodeData;
}

export function isScriptStudioJsonV1Project(
  graphMeta?: CanvasGraph["meta"],
  hubData?: StoryProScriptHubNodeData,
): boolean {
  return (
    graphMeta?.scriptStudioFormat === SCRIPT_STUDIO_FORMAT_JSON_V1 ||
    hubData?.scriptStudioFormat === SCRIPT_STUDIO_FORMAT_JSON_V1
  );
}

function shouldUseJsonApply(
  output: string,
  graphMeta?: CanvasGraph["meta"],
  hubData?: StoryProScriptHubNodeData,
): boolean {
  if (isScriptStudioJsonOutput(output)) return true;
  if (isScriptStudioJsonV1Project(graphMeta, hubData)) return false;
  return false;
}

function applyJsonBatchResult(
  runNode: CanvasFlowNode,
  batchJson: ReturnType<typeof extractScriptStudioBatchRaw>,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  graphMeta?: CanvasGraph["meta"],
): void {
  if (!batchJson) return;
  const d = readRunFields(runNode);
  const hubId = resolveHubId(runNode, allNodes);
  if (!hubId) return;

  const hub = allNodes.find((n) => n.id === hubId);
  const hubData = (hub?.data ?? {}) as StoryProScriptHubNodeData;
  const batchIndex =
    hubData.scriptStudioBatchIndex ?? d.scriptStudioBatchIndex ?? 0;

  const displayMd = renderScriptStudioBatchMarkdown(batchJson);
  const prevCanonical = parseScriptStudioCanonicalJson(
    hubData.scriptStudioCanonicalJson ?? d.scriptStudioCanonicalJson,
  );
  const nextCanonical = [...prevCanonical, batchJson];

  const prevCompleted =
    hubData.scriptStudioCompletedBatchesMd?.trim() ||
    d.scriptStudioCompletedBatchesMd?.trim() ||
    "";
  const completedMd = prevCompleted
    ? `${prevCompleted}\n\n---\n\n${displayMd}`
    : displayMd;

  const hubPatch: Record<string, unknown> = {
    scriptStudioMode: true,
    scriptStudioFormat: SCRIPT_STUDIO_FORMAT_JSON_V1,
    scriptStudioCanonicalJson: nextCanonical,
    scriptStudioCompletedBatchesMd: completedMd,
    scriptStudioBatchIndex: batchIndex + 1,
    scriptStudioSystem:
      hubData.scriptStudioSystem ?? d.scriptStudioSystem ?? "original",
    scriptStudioTotalEpisodes:
      hubData.scriptStudioTotalEpisodes ?? d.scriptStudioTotalEpisodes ?? 30,
  };

  if (batchIndex === 0 && batchJson.frozenBibles) {
    const frozenMd = renderFrozenBiblesMarkdown(batchJson.frozenBibles);
    maybeDeferLargeMd(
      hubId,
      "scriptStudioFrozenBiblesMd",
      "scriptStudioFrozenBiblesOssUrl",
      frozenMd,
      updateNodeData,
    );
    hubPatch.scriptStudioFrozenBiblesMd = frozenMd.slice(0, INLINE_MD_LIMIT);
  } else if (hubData.scriptStudioFrozenBiblesMd?.trim()) {
    hubPatch.scriptStudioFrozenBiblesMd = hubData.scriptStudioFrozenBiblesMd;
  }

  const prevOutline = hubData.outlineMd?.trim() ?? "";
  hubPatch.outlineMd = prevOutline
    ? `${prevOutline}\n\n${displayMd}`
    : displayMd;

  const sync = aggregateScriptStudioJsonBatchRows(batchJson, hubId);

  const prevChars = hubData.scriptStudioCharacterRows ?? [];
  const prevScenes = hubData.sceneRows ?? [];
  const prevProps = hubData.scriptStudioPropRows ?? [];
  const prevFrames = hubData.scriptStudioFrameRows ?? [];
  const prevMoods = hubData.scriptStudioMoodRows ?? [];
  const prevAudios = hubData.scriptStudioAudioRows ?? [];

  const epByFrame = new Map<number, number>();
  for (const ep of batchJson.episodes) {
    for (const shot of ep.module7_storyboard) {
      epByFrame.set(shot.frameIndex, ep.episodeNo);
    }
  }

  const mergedFrames = attachPropRefsToFrames(
    mergeFrameRows(prevFrames, sync.frames),
    mergeRowsByKey(prevProps, sync.props),
  ).map((r) => ({
    ...r,
    episodeNo: r.episodeNo ?? epByFrame.get(r.frameIndex),
    stageStatus: r.stageStatus ?? "draft",
  }));

  hubPatch.scriptStudioCharacterRows = mergeRowsByKey(prevChars, sync.characters);
  hubPatch.sceneRows = mergeSceneRows(prevScenes, sync.scenes, hubId);
  hubPatch.scriptStudioPropRows = mergeRowsByKey(prevProps, sync.props);
  hubPatch.scriptStudioFrameRows = mergedFrames;
  hubPatch.scriptStudioMoodRows = mergeRowsByKey(prevMoods, sync.moods);
  hubPatch.scriptStudioAudioRows = mergeRowsByKey(prevAudios, sync.audios);

  updateNodeData(hubId, hubPatch);

  if (completedMd.length > INLINE_MD_LIMIT) {
    void import("./script-studio-oss-upload").then(({ uploadScriptStudioTextToOss }) =>
      uploadScriptStudioTextToOss(completedMd, "script-studio-batches.md").then(
        (url) => {
          if (url) {
            updateNodeData(hubId, {
              scriptStudioCompletedBatchesOssUrl: url,
            });
          }
        },
      ),
    );
  }

  if (runNode.type === "story-pro2-starter" && runNode.id !== hubId) {
    updateNodeData(runNode.id, {
      scriptStudioFormat: SCRIPT_STUDIO_FORMAT_JSON_V1,
      scriptStudioCanonicalJson: nextCanonical,
      scriptStudioCompletedBatchesMd: completedMd,
      scriptStudioBatchIndex: batchIndex + 1,
      workspaceIds: {
        ...((runNode.data as StoryProStarterNodeData).workspaceIds ?? {}),
        scriptHubId: hubId,
      },
    });
  }

  void graphMeta;
}

function applyMdBatchResult(
  runNode: CanvasFlowNode,
  batchMd: string,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const d = readRunFields(runNode);
  const hubId = resolveHubId(runNode, allNodes);
  if (!hubId) return;

  const hub = allNodes.find((n) => n.id === hubId);
  const hubData = (hub?.data ?? {}) as StoryProScriptHubNodeData;
  const batchIndex =
    hubData.scriptStudioBatchIndex ?? d.scriptStudioBatchIndex ?? 0;

  const prevCompleted =
    hubData.scriptStudioCompletedBatchesMd?.trim() ||
    d.scriptStudioCompletedBatchesMd?.trim() ||
    "";
  const completedMd = prevCompleted
    ? `${prevCompleted}\n\n---\n\n${batchMd.trim()}`
    : batchMd.trim();

  const hubPatch: Record<string, unknown> = {
    scriptStudioMode: true,
    scriptStudioCompletedBatchesMd: completedMd,
    scriptStudioBatchIndex: batchIndex + 1,
    scriptStudioSystem:
      hubData.scriptStudioSystem ?? d.scriptStudioSystem ?? "original",
    scriptStudioTotalEpisodes:
      hubData.scriptStudioTotalEpisodes ?? d.scriptStudioTotalEpisodes ?? 30,
  };

  if (batchIndex === 0 && !hubData.scriptStudioFrozenBiblesMd?.trim()) {
    const frozen = extractScriptStudioFrozenBiblesMd(batchMd);
    if (frozen) {
      maybeDeferLargeMd(
        hubId,
        "scriptStudioFrozenBiblesMd",
        "scriptStudioFrozenBiblesOssUrl",
        frozen,
        updateNodeData,
      );
      hubPatch.scriptStudioFrozenBiblesMd = frozen.slice(0, INLINE_MD_LIMIT);
    }
  } else if (hubData.scriptStudioFrozenBiblesMd?.trim()) {
    hubPatch.scriptStudioFrozenBiblesMd = hubData.scriptStudioFrozenBiblesMd;
  }

  const prevOutline = hubData.outlineMd?.trim() ?? "";
  hubPatch.outlineMd = prevOutline
    ? `${prevOutline}\n\n${batchMd.trim()}`
    : batchMd.trim();

  const sync = aggregateBatchRowsFromMd(batchMd, hubId);

  const prevChars = hubData.scriptStudioCharacterRows ?? [];
  const prevScenes = hubData.sceneRows ?? [];
  const prevProps = hubData.scriptStudioPropRows ?? [];
  const prevFrames = hubData.scriptStudioFrameRows ?? [];
  const prevMoods = hubData.scriptStudioMoodRows ?? [];
  const prevAudios = hubData.scriptStudioAudioRows ?? [];

  const batch = parseScriptStudioBatch(batchMd);
  const epByFrame = new Map<number, number>();
  for (const ep of batch.episodes) {
    for (const shot of ep.shots) {
      epByFrame.set(shot.frameIndex, ep.episodeNo);
    }
  }

  const mergedFrames = attachPropRefsToFrames(
    mergeFrameRows(prevFrames, sync.frames),
    mergeRowsByKey(prevProps, sync.props),
  ).map((r) => ({
    ...r,
    episodeNo: r.episodeNo ?? epByFrame.get(r.frameIndex),
    stageStatus: r.stageStatus ?? "draft",
  }));

  hubPatch.scriptStudioCharacterRows = mergeRowsByKey(prevChars, sync.characters);
  hubPatch.sceneRows = mergeSceneRows(prevScenes, sync.scenes, hubId);
  hubPatch.scriptStudioPropRows = mergeRowsByKey(prevProps, sync.props);
  hubPatch.scriptStudioFrameRows = mergedFrames;
  hubPatch.scriptStudioMoodRows = mergeRowsByKey(prevMoods, sync.moods);
  hubPatch.scriptStudioAudioRows = mergeRowsByKey(prevAudios, sync.audios);

  updateNodeData(hubId, hubPatch);

  if (completedMd.length > INLINE_MD_LIMIT) {
    void import("./script-studio-oss-upload").then(({ uploadScriptStudioTextToOss }) =>
      uploadScriptStudioTextToOss(completedMd, "script-studio-batches.md").then(
        (url) => {
          if (url) {
            updateNodeData(hubId, {
              scriptStudioCompletedBatchesOssUrl: url,
            });
          }
        },
      ),
    );
  }

  if (runNode.type === "story-pro2-starter" && runNode.id !== hubId) {
    updateNodeData(runNode.id, {
      scriptStudioCompletedBatchesMd: completedMd,
      scriptStudioBatchIndex: batchIndex + 1,
      workspaceIds: {
        ...((runNode.data as StoryProStarterNodeData).workspaceIds ?? {}),
        scriptHubId: hubId,
      },
    });
  }
}

/** themeOutline / scriptStudioBatch 成功且 scriptStudioMode 时，解析批次并合并到 hub 内嵌 rows */
export function applyScriptStudioThemeOutlineResult(
  runNode: CanvasFlowNode,
  batchOutput: string,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  graphMeta?: CanvasGraph["meta"],
): void {
  const d = readRunFields(runNode);
  if (!d.scriptStudioMode || !batchOutput.trim()) return;

  const hubId = resolveHubId(runNode, allNodes);
  const hub = hubId ? allNodes.find((n) => n.id === hubId) : undefined;
  const hubData = (hub?.data ?? {}) as StoryProScriptHubNodeData;

  if (shouldUseJsonApply(batchOutput, graphMeta, hubData)) {
    const batchJson = extractScriptStudioBatchRaw(batchOutput);
    if (batchJson) {
      applyJsonBatchResult(
        runNode,
        batchJson,
        allNodes,
        updateNodeData,
        graphMeta,
      );
      return;
    }
  }

  if (isScriptStudioJsonV1Project(graphMeta, hubData)) {
    return;
  }

  applyMdBatchResult(runNode, batchOutput, allNodes, updateNodeData);
}

export { buildScriptStudioContinuationContext };

export { findScriptStudioHub, findCrewBulletinHub } from "./crew-bulletin-hub-find";
