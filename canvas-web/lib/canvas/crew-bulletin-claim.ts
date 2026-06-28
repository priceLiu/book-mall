import type { CanvasFlowNode } from "./types";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  buildPro2ThreeViewNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_MIN_WIDTH,
} from "./story-pro2-node-chrome";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CrewBulletinTask } from "./crew-bulletin-types";
import {
  findCrewTaskRow,
  resolveCrewBulletinRowsContext,
  resolveCrewTaskDockInput,
} from "./crew-bulletin-task-prompts";

type ClaimStore = {
  nodes: CanvasFlowNode[];
  addNode: (
    type: string,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (
    fn: (edges: import("./types").CanvasFlowEdge[]) => import("./types").CanvasFlowEdge[],
  ) => void;
};

const crewTaskNodeExtras = (task: CrewBulletinTask) => ({
  crewTaskId: task.id,
  crewTaskKind: task.kind,
});

function spawnPosition(
  hub: CanvasFlowNode,
  index: number,
  kind: CrewBulletinTask["kind"],
): { x: number; y: number } {
  const hubW = hub.width ?? PRO2_TEXT_NODE_MIN_WIDTH;
  const col = index % 3;
  const row = Math.floor(index / 3);
  const baseX = hub.position.x + hubW + 80 + col * 380;
  const baseY = hub.position.y + row * 420;
  if (kind === "character") {
    return { x: baseX, y: baseY };
  }
  return { x: baseX, y: baseY + (kind === "frame" ? 40 : 0) };
}

function spawnCrewWorkNodeAtPosition(
  task: CrewBulletinTask,
  hubId: string,
  store: ClaimStore,
  pos: { x: number; y: number },
  row: unknown,
  dockInput: string,
): string | null {
  if (task.kind === "character") {
    const charRow = row as import("./story-pro-workspace-types").StoryProCharacterRow | undefined;
    const label = charRow?.name?.trim() || task.label;
    const nodeId = store.addNode(
      "story-pro2-three-view",
      pos,
      {
        ...buildPro2ThreeViewNodeData({
          label,
          dockInput,
          pro2RowKey: task.rowKey,
          pro2HubNodeId: hubId,
        }),
        ...crewTaskNodeExtras(task),
      },
    );
    if (nodeId) selectPro2NodeAfterSpawn(store.setNodes, nodeId);
    return nodeId || null;
  }

  if (task.kind === "scene") {
    const sceneRow = row as import("./story-pro-workspace-types").StoryProSceneRow | undefined;
    const nodeId = store.addNode("story-pro2-image", pos, {
      ...buildPro2ImageNodeData(),
      pro2MediaRole: "scene",
      pro2RowKey: task.rowKey,
      pro2HubNodeId: hubId,
      dockInput,
      label: sceneRow?.name?.trim() ?? task.label,
      ...crewTaskNodeExtras(task),
    });
    if (nodeId) selectPro2NodeAfterSpawn(store.setNodes, nodeId);
    return nodeId || null;
  }

  if (task.kind === "prop" || task.kind === "mood" || task.kind === "audio") {
    const nodeType =
      task.kind === "prop"
        ? "story-pro2-prop"
        : task.kind === "mood"
          ? "story-pro2-mood"
          : "story-pro2-audio";
    const mediaRow = row as
      | import("./story-pro-workspace-types").StoryProPropRow
      | undefined;
    const nodeId = store.addNode(nodeType, pos, {
      label: mediaRow?.name?.trim() ?? task.label,
      dockInput,
      scriptStudioSourceRowKey: task.rowKey,
      scriptStudioMediaKind: task.kind,
      hubNodeId: hubId,
      pro2RowKey: task.rowKey,
      pro2HubNodeId: hubId,
      ...crewTaskNodeExtras(task),
    });
    if (nodeId) selectPro2NodeAfterSpawn(store.setNodes, nodeId);
    return nodeId || null;
  }

  if (task.kind === "frame") {
    const frameRow = row as import("./story-pro-workspace-types").StoryProFrameRow | undefined;
    const label =
      frameRow?.frameIndex != null
        ? `镜 ${frameRow.frameIndex}`
        : task.label;
    const nodeId = store.addNode("story-pro2-image", pos, {
      ...buildPro2ImageNodeData(),
      pro2MediaRole: "frame",
      pro2RowKey: task.rowKey,
      pro2HubNodeId: hubId,
      dockInput,
      label,
      ...crewTaskNodeExtras(task),
    });
    if (nodeId) selectPro2NodeAfterSpawn(store.setNodes, nodeId);
    return nodeId || null;
  }

  return null;
}

/** 领取任务并在画布生成对应工作节点，返回新节点 id */
export function spawnCrewWorkNodeForTask(
  task: CrewBulletinTask,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  store: ClaimStore,
  spawnIndex: number,
  opts?: { spawnAnchorNodeId?: string },
): string | null {
  const ctx = resolveCrewBulletinRowsContext(hubId, hubData);
  const row = findCrewTaskRow(task, hubId, hubData, ctx);
  const dockInput = resolveCrewTaskDockInput(task, hubId, hubData, ctx);

  const hub =
    store.nodes.find((n) => n.id === hubId) ??
    (opts?.spawnAnchorNodeId
      ? store.nodes.find((n) => n.id === opts.spawnAnchorNodeId)
      : undefined);

  const pos = hub
    ? spawnPosition(hub, spawnIndex, task.kind)
    : viewportCenterSpawnOffset(spawnIndex);

  return spawnCrewWorkNodeAtPosition(task, hubId, store, pos, row, dockInput);
}

/** 选中剧本节点并在右侧 spawn 参考文本节点（只读引用） */
export function spawnScriptReferenceTextNode(
  hubId: string,
  store: ClaimStore,
): string | null {
  const hub = store.nodes.find((n) => n.id === hubId);
  if (!hub) return null;
  const w = hub.width ?? PRO2_TEXT_NODE_MIN_WIDTH;
  const nodeId = store.addNode(
    "story-pro2-starter",
    { x: hub.position.x + w + 48, y: hub.position.y },
    buildPro2StarterNodeData({ pro2TextPurpose: "general" }),
  );
  if (!nodeId) return null;
  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${hubId}-${nodeId}`,
      source: hubId,
      target: nodeId,
      sourceHandle: "text",
      targetHandle: "in_text",
    },
  ]);
  selectPro2NodeAfterSpawn(store.setNodes, nodeId);
  return nodeId;
}

export function viewportCenterSpawnOffset(index: number): { x: number; y: number } {
  return {
    x: 120 + (index % 4) * (PRO2_IMAGE_NODE_MIN_WIDTH + 40),
    y: 80 + Math.floor(index / 4) * 380,
  };
}
