import { crewBulletinFromScriptPackagePayload, refreshGraphAnchorCrewBulletin } from "./crew-bulletin-script-package";
import { resolveHubRowsForCrewBulletin } from "./crew-bulletin-build";
import { dedupeProSceneRows } from "./story-pro-column-sync";
import type { CrewBulletinState } from "./crew-bulletin-types";
import {
  parseScriptPackageSnapshotsFromPayload,
  type ScriptPackageSnapshotsByKind,
} from "./script-package-snapshots";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import type { CanvasGraph } from "./types";

/** patchAnchor / refresh 用的虚拟锚点 id（无画布节点） */
export const CREW_BULLETIN_META_ANCHOR_ID = "__crew_bulletin_meta__";

export type CrewBulletinGraphAnchor = {
  linkedScriptPackageAssetId: string;
  linkedScriptPackageTitle?: string;
  linkedScriptPackageMarkdown?: string;
  /** 角色 / 场景 / 分镜 Markdown · 公告条详情回落 */
  characterMd?: string;
  sceneMd?: string;
  storyboardMd?: string;
  crewBulletin: CrewBulletinState;
  scriptStudioTotalEpisodes?: number;
  scriptStudioCharacterRows?: StoryProScriptHubNodeData["scriptStudioCharacterRows"];
  sceneRows?: StoryProScriptHubNodeData["sceneRows"];
  scriptStudioPropRows?: StoryProScriptHubNodeData["scriptStudioPropRows"];
  scriptStudioFrameRows?: StoryProScriptHubNodeData["scriptStudioFrameRows"];
  scriptStudioMoodRows?: StoryProScriptHubNodeData["scriptStudioMoodRows"];
  scriptStudioAudioRows?: StoryProScriptHubNodeData["scriptStudioAudioRows"];
  /** 按运行栏种类归档的完成快照 · 写入 SCRIPT_PACKAGE 资产 */
  scriptPackageSnapshots?: ScriptPackageSnapshotsByKind;
};

export function hubFieldsFromGraphAnchor(
  anchor: CrewBulletinGraphAnchor,
): StoryProScriptHubNodeData {
  return {
    outlineMd: anchor.linkedScriptPackageMarkdown ?? "",
    characterMd: anchor.characterMd ?? "",
    sceneMd: anchor.sceneMd ?? "",
    storyboardMd: anchor.storyboardMd ?? "",
    providerId: "",
    modelKey: "",
    promptOutline: "",
    promptCharacter: "",
    promptStoryboard: "",
    scriptStudioTotalEpisodes: anchor.scriptStudioTotalEpisodes ?? 30,
    scriptStudioCharacterRows: anchor.scriptStudioCharacterRows,
    sceneRows: anchor.sceneRows,
    scriptStudioPropRows: anchor.scriptStudioPropRows,
    scriptStudioFrameRows: anchor.scriptStudioFrameRows,
    scriptStudioMoodRows: anchor.scriptStudioMoodRows,
    scriptStudioAudioRows: anchor.scriptStudioAudioRows,
    crewBulletin: anchor.crewBulletin,
    scriptPublished: true,
  };
}

/** 从 hub 行 / Markdown 补全 meta 锚点上的结构化 rows */
export function enrichCrewBulletinGraphAnchorRows(
  anchor: CrewBulletinGraphAnchor,
): CrewBulletinGraphAnchor {
  const hubFields = hubFieldsFromGraphAnchor(anchor);
  const resolved = resolveHubRowsForCrewBulletin(
    CREW_BULLETIN_META_ANCHOR_ID,
    hubFields,
  );
  const pick = <T>(stored: T[] | undefined, built: T[]): T[] | undefined => {
    if (stored?.length) return stored;
    return built.length ? built : stored;
  };
  const sceneRows = dedupeProSceneRows(
    [...(anchor.sceneRows ?? []), ...resolved.scenes],
    CREW_BULLETIN_META_ANCHOR_ID,
  );
  return {
    ...anchor,
    scriptStudioCharacterRows: pick(
      anchor.scriptStudioCharacterRows,
      resolved.characters,
    ),
    sceneRows,
    scriptStudioPropRows: pick(anchor.scriptStudioPropRows, resolved.props),
    scriptStudioFrameRows: pick(anchor.scriptStudioFrameRows, resolved.frames),
    scriptStudioMoodRows: pick(anchor.scriptStudioMoodRows, resolved.moods),
    scriptStudioAudioRows: pick(anchor.scriptStudioAudioRows, resolved.audios),
  };
}

export function buildCrewBulletinGraphAnchorFromAsset(asset: {
  id: string;
  displayName: string;
  payload: Record<string, unknown>;
}): CrewBulletinGraphAnchor {
  const { bulletin, hubFields } = crewBulletinFromScriptPackagePayload(
    asset.id,
    asset.displayName,
    asset.payload,
  );
  const anchor: CrewBulletinGraphAnchor = {
    linkedScriptPackageAssetId: asset.id,
    linkedScriptPackageTitle: asset.displayName,
    linkedScriptPackageMarkdown: String(asset.payload.markdown ?? "").slice(
      0,
      32000,
    ),
    characterMd: String(payloadField(asset.payload, "characterMd") ?? "").slice(
      0,
      32000,
    ),
    sceneMd: String(payloadField(asset.payload, "sceneMd") ?? "").slice(
      0,
      32000,
    ),
    storyboardMd: String(
      payloadField(asset.payload, "storyboardMd") ?? "",
    ).slice(0, 32000),
    crewBulletin: bulletin,
    scriptStudioTotalEpisodes: hubFields.scriptStudioTotalEpisodes,
    scriptStudioCharacterRows: hubFields.scriptStudioCharacterRows ?? [],
    sceneRows: hubFields.sceneRows ?? [],
    scriptStudioPropRows: hubFields.scriptStudioPropRows ?? [],
    scriptStudioFrameRows: hubFields.scriptStudioFrameRows ?? [],
    scriptStudioMoodRows: hubFields.scriptStudioMoodRows ?? [],
    scriptStudioAudioRows: hubFields.scriptStudioAudioRows ?? [],
    scriptPackageSnapshots: parseScriptPackageSnapshotsFromPayload(
      asset.payload,
    ),
  };
  return enrichCrewBulletinGraphAnchorRows(
    refreshGraphAnchorCrewBulletin(anchor),
  );
}

function payloadField(payload: Record<string, unknown>, key: string): unknown {
  const v = payload[key];
  return v == null ? undefined : v;
}

export function buildGraphAnchorFromStarterData(
  d: StoryProStarterNodeData,
  assetId: string,
): CrewBulletinGraphAnchor {
  return enrichCrewBulletinGraphAnchorRows({
    linkedScriptPackageAssetId: assetId,
    linkedScriptPackageTitle: d.linkedScriptPackageTitle,
    linkedScriptPackageMarkdown: d.linkedScriptPackageMarkdown,
    crewBulletin: d.crewBulletin!,
    scriptStudioTotalEpisodes: d.scriptStudioTotalEpisodes,
    scriptStudioCharacterRows: d.scriptStudioCharacterRows,
    sceneRows: d.sceneRows,
    scriptStudioPropRows: d.scriptStudioPropRows,
    scriptStudioFrameRows: d.scriptStudioFrameRows,
    scriptStudioMoodRows: d.scriptStudioMoodRows,
    scriptStudioAudioRows: d.scriptStudioAudioRows,
  });
}

/** 纯协作 starter（仅关联剧本包）→ graph.meta 锚点，画布零节点 */
export function migrateLinkedScriptPackageStarterToMeta(
  graph: CanvasGraph,
): CanvasGraph {
  if (graph.meta?.crewBulletinAnchor?.crewBulletin?.tasks?.length) {
    return graph;
  }
  const starterIdx = graph.nodes.findIndex((n) => n.type === "story-pro2-starter");
  if (starterIdx < 0) return graph;

  const starter = graph.nodes[starterIdx]!;
  const d = starter.data as StoryProStarterNodeData;
  const assetId = d.workspaceIds?.linkedScriptPackageAssetId;
  if (!assetId || !d.crewBulletin?.tasks?.length) return graph;
  if (d.scriptStudioMode === true) return graph;
  if (d.generatedOutlineMd?.trim() || d.uploadedScriptMd?.trim()) return graph;

  const anchor = buildGraphAnchorFromStarterData(d, assetId);
  const nodes = graph.nodes.filter((_, i) => i !== starterIdx);
  const edges = graph.edges.filter(
    (e) => e.source !== starter.id && e.target !== starter.id,
  );

  return {
    ...graph,
    nodes,
    edges,
    meta: {
      ...graph.meta,
      edition: graph.meta?.edition ?? "pro2",
      linkedScriptPackageAssetId: assetId,
      crewBulletinAnchor: anchor,
    },
  };
}
