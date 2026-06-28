import type { CanvasFlowNode, CanvasGraph } from "./types";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import type { CrewBulletinState } from "./crew-bulletin-types";
import { findScriptStudioHub } from "./script-studio-run-apply";
import {
  CREW_BULLETIN_META_ANCHOR_ID,
  hubFieldsFromGraphAnchor,
} from "./crew-bulletin-graph-anchor";

export type CrewBulletinAnchorMode = "script-studio" | "linked-package";

export type CrewBulletinAnchor = {
  mode: CrewBulletinAnchorMode;
  /** 数据存于 graph.meta 时为虚拟 id */
  anchorStorage: "node" | "graph-meta";
  nodeId: string;
  published: boolean;
  bulletin: CrewBulletinState | undefined;
  hubFields: StoryProScriptHubNodeData;
};

function graphMetaLinkedBulletin(
  meta: CanvasGraph["meta"],
): CrewBulletinAnchor | null {
  const anchor = meta?.crewBulletinAnchor;
  if (!anchor?.crewBulletin?.tasks?.length) return null;

  return {
    mode: "linked-package",
    anchorStorage: "graph-meta",
    nodeId: CREW_BULLETIN_META_ANCHOR_ID,
    published: true,
    bulletin: anchor.crewBulletin,
    hubFields: hubFieldsFromGraphAnchor(anchor),
  };
}

function starterLinkedBulletin(
  starter: CanvasFlowNode,
): CrewBulletinAnchor | null {
  const d = starter.data as StoryProStarterNodeData & {
    crewBulletin?: CrewBulletinState;
    linkedScriptPackageTitle?: string;
    linkedScriptPackageMarkdown?: string;
    scriptStudioCharacterRows?: StoryProScriptHubNodeData["scriptStudioCharacterRows"];
    sceneRows?: StoryProScriptHubNodeData["sceneRows"];
    scriptStudioPropRows?: StoryProScriptHubNodeData["scriptStudioPropRows"];
    scriptStudioFrameRows?: StoryProScriptHubNodeData["scriptStudioFrameRows"];
    scriptStudioMoodRows?: StoryProScriptHubNodeData["scriptStudioMoodRows"];
    scriptStudioAudioRows?: StoryProScriptHubNodeData["scriptStudioAudioRows"];
  };
  const assetId = d.workspaceIds?.linkedScriptPackageAssetId;
  const bulletin = d.crewBulletin;
  if (!assetId || !bulletin?.tasks?.length) return null;

  return {
    mode: "linked-package",
    anchorStorage: "node",
    nodeId: starter.id,
    published: true,
    bulletin,
    hubFields: {
      outlineMd:
        d.linkedScriptPackageMarkdown ??
        d.scriptStudioCompletedBatchesMd ??
        d.generatedOutlineMd ??
        "",
      characterMd: "",
      storyboardMd: "",
      providerId: d.providerId ?? "",
      modelKey: d.modelKey ?? "",
      promptOutline: "",
      promptCharacter: "",
      promptStoryboard: "",
      scriptStudioTotalEpisodes: d.scriptStudioTotalEpisodes ?? 30,
      scriptStudioCharacterRows: d.scriptStudioCharacterRows,
      sceneRows: d.sceneRows,
      scriptStudioPropRows: d.scriptStudioPropRows,
      scriptStudioFrameRows: d.scriptStudioFrameRows,
      scriptStudioMoodRows: d.scriptStudioMoodRows,
      scriptStudioAudioRows: d.scriptStudioAudioRows,
      crewBulletin: bulletin,
      scriptPublished: true,
    },
  };
}

/** 公告条数据锚点：剧本创作 hub / graph.meta / starter 关联包 */
export function resolveCrewBulletinAnchor(
  nodes: CanvasFlowNode[],
  graphMeta?: CanvasGraph["meta"],
): CrewBulletinAnchor | null {
  const hub = findScriptStudioHub(nodes);
  if (hub) {
    const d = hub.data as StoryProScriptHubNodeData;
    return {
      mode: "script-studio",
      anchorStorage: "node",
      nodeId: hub.id,
      published: d.scriptPublished === true,
      bulletin: d.crewBulletin,
      hubFields: d,
    };
  }

  const metaLinked = graphMetaLinkedBulletin(graphMeta);
  if (metaLinked) return metaLinked;

  const starter = nodes.find((n) => n.type === "story-pro2-starter");
  if (starter) {
    const linked = starterLinkedBulletin(starter);
    if (linked) return linked;
  }

  return null;
}

/** 是否显示公告条（已发布剧本 / 已关联剧本包 · 不含未发布创作态） */
export function shouldShowCrewBulletinRail(
  nodes: CanvasFlowNode[],
  graphMeta?: CanvasGraph["meta"],
): boolean {
  const anchor = resolveCrewBulletinAnchor(nodes, graphMeta);
  if (!anchor) return false;
  if (anchor.mode === "script-studio" && !anchor.published) return false;
  return true;
}

export function findPro2BulletinStarter(
  nodes: CanvasFlowNode[],
): CanvasFlowNode | undefined {
  return nodes.find((n) => n.type === "story-pro2-starter");
}

export function isCrewBulletinGraphMetaAnchor(anchor: CrewBulletinAnchor): boolean {
  return anchor.anchorStorage === "graph-meta";
}
