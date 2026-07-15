/**
 * 工业化剧本批次生成结果 → hub 内嵌 rows（不自动 spawn 列节点 / 连线）
 */
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
import type { CanvasFlowNode } from "./types";

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

function aggregateBatchRows(batchMd: string, hubId: string): AggregatedSync {
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
): void {
  if (md.length <= INLINE_MD_LIMIT) {
    updateNodeData(nodeId, { [fieldInline]: md, [fieldOss]: "" });
    return;
  }
  updateNodeData(nodeId, {
    [fieldInline]: `${md.slice(0, INLINE_MD_LIMIT)}\n\n…（正文已截断，完整内容见 OSS）`,
  });
  void import("./script-studio-oss-upload").then(({ uploadScriptStudioTextToOss }) =>
    uploadScriptStudioTextToOss(md, "script-studio-bibles.md").then((url) => {
      if (url) updateNodeData(nodeId, { [fieldOss]: url });
    }),
  );
}

type ScriptStudioRunFields = {
  scriptStudioMode?: boolean;
  scriptStudioBatchIndex?: number;
  scriptStudioCompletedBatchesMd?: string;
  scriptStudioFrozenBiblesMd?: string;
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

/** themeOutline 成功且 scriptStudioMode 时，解析批次 MD 并合并到 hub 内嵌 rows */
export function applyScriptStudioThemeOutlineResult(
  runNode: CanvasFlowNode,
  batchMd: string,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const d = readRunFields(runNode);
  if (!d.scriptStudioMode || !batchMd.trim()) return;

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

  const sync = aggregateBatchRows(batchMd, hubId);

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

export function findScriptStudioHub(
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  return nodes.find(
    (n) =>
      n.type === "story-pro2-script-hub" &&
      (n.data as StoryProScriptHubNodeData).scriptStudioMode === true,
  );
}
