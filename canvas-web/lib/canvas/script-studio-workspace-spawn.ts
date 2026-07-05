/**
 * 剧本创作画布 · 自动 spawn hub + 数据列（解析 rows 落库用，UI 仍走 2.0 媒体卡）
 */
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import {
  spawnStoryPro2CharacterColumnFromHub,
  spawnStoryPro2FrameColumnFromHub,
  spawnStoryPro2SceneColumnFromHub,
  spawnStoryPro2ScriptHub,
} from "./spawn-story-pro2-workspace";
import { NODE_DEFAULT_SIZE } from "./types";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";
import { STORY_PRO2_THEME_OUTLINE_SYSTEM } from "./story-pro2-theme-outline-prompt";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";

type Pro2AddNode = (
  type: string,
  position: { x: number; y: number },
  data: Record<string, unknown>,
) => string;

export type ScriptStudioWorkspaceSpawnArgs = {
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: Pro2AddNode;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

function connect(
  setEdges: ScriptStudioWorkspaceSpawnArgs["setEdges"],
  source: string,
  target: string,
) {
  setEdges((prev) => {
    if (prev.some((e) => e.source === source && e.target === target)) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-ss-${source.slice(-4)}-${target.slice(-4)}`,
        source,
        target,
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ];
  });
}

function spawnPropMoodAudioColumn(
  args: ScriptStudioWorkspaceSpawnArgs,
  scriptHubId: string,
  starterNodeId: string,
  type: "story-pro2-prop" | "story-pro2-mood" | "story-pro2-audio",
  wsKey: "propColumnId" | "moodColumnId" | "audioColumnId",
  yOffset: number,
): string {
  const starter = args.nodes.find((n) => n.id === starterNodeId);
  const ws = (starter?.data as { workspaceIds?: StoryPro2WorkspaceIds })
    ?.workspaceIds;
  const existingId = ws?.[wsKey];
  if (existingId) {
    const existing = args.nodes.find((n) => n.id === existingId);
    if (existing?.type === type) return existingId;
  }

  const hub = args.nodes.find((n) => n.id === scriptHubId);
  const hubX = hub?.position?.x ?? 400;
  const hubY = hub?.position?.y ?? 120;
  const size = NODE_DEFAULT_SIZE[type];
  const columnId = args.addNode(
    type,
    { x: hubX - size.width - 80, y: hubY + yOffset },
    { rows: [], hubNodeId: scriptHubId },
  );
  connect(args.setEdges, scriptHubId, columnId);

  const nextWs: StoryPro2WorkspaceIds = {
    ...(ws ?? { scriptHubId }),
    scriptHubId,
    [wsKey]: columnId,
  };
  args.updateNodeData(starterNodeId, { workspaceIds: nextWs });
  return columnId;
}

/** 确保 script-studio 工作区节点链存在，返回最新 workspaceIds */
export function ensureScriptStudioWorkspace(
  args: ScriptStudioWorkspaceSpawnArgs,
): StoryPro2WorkspaceIds {
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  if (!starter) throw new Error("找不到 starter 节点");

  const d = starter.data as StoryProStarterNodeData;
  let nodes = args.nodes;
  let ws: Partial<StoryPro2WorkspaceIds> = d.workspaceIds ?? {};

  const sharedLlm = {
    providerId: d.providerId ?? "",
    modelKey: d.modelKey ?? "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...(d.params ?? {}) },
  };

  if (!ws.scriptHubId) {
    const { scriptHubId } = spawnStoryPro2ScriptHub({
      starterNodeId: args.starterNodeId,
      systemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      ...sharedLlm,
      nodes,
      edges: args.edges,
      addNode: args.addNode as never,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
    ws = { ...ws, scriptHubId };
    nodes = [
      ...nodes,
      {
        id: scriptHubId,
        type: "story-pro2-script-hub",
        position: starter.position,
        data: {},
      } as CanvasFlowNode,
    ];
  }

  const scriptHubId = ws.scriptHubId!;

  if (!ws.characterColumnId) {
    ws.characterColumnId = spawnStoryPro2CharacterColumnFromHub({
      scriptHubId,
      starterNodeId: args.starterNodeId,
      nodes,
      edges: args.edges,
      addNode: args.addNode as never,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
  }
  if (!ws.sceneColumnId) {
    ws.sceneColumnId = spawnStoryPro2SceneColumnFromHub({
      scriptHubId,
      starterNodeId: args.starterNodeId,
      nodes,
      edges: args.edges,
      addNode: args.addNode as never,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
  }
  if (!ws.frameColumnId) {
    ws.frameColumnId = spawnStoryPro2FrameColumnFromHub({
      scriptHubId,
      starterNodeId: args.starterNodeId,
      nodes,
      edges: args.edges,
      addNode: args.addNode as never,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
  }
  if (!ws.propColumnId) {
    ws.propColumnId = spawnPropMoodAudioColumn(
      args,
      scriptHubId,
      args.starterNodeId,
      "story-pro2-prop",
      "propColumnId",
      280,
    );
  }
  if (!ws.moodColumnId) {
    ws.moodColumnId = spawnPropMoodAudioColumn(
      args,
      scriptHubId,
      args.starterNodeId,
      "story-pro2-mood",
      "moodColumnId",
      560,
    );
  }
  if (!ws.audioColumnId) {
    ws.audioColumnId = spawnPropMoodAudioColumn(
      args,
      scriptHubId,
      args.starterNodeId,
      "story-pro2-audio",
      "audioColumnId",
      840,
    );
  }

  args.updateNodeData(args.starterNodeId, {
    workspaceIds: ws,
    scriptStudioMode: true,
  });
  args.updateNodeData(scriptHubId, { scriptStudioMode: true });

  return ws as StoryPro2WorkspaceIds;
}
