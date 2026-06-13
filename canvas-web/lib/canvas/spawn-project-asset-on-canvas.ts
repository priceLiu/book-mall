/**
 * 项目资产 → 画布节点：insert-map 归一化 + spawn（拖放 / 插入按钮）
 */
import { mapProjectAssetInsert } from "@/lib/canvas-api";
import type { CanvasProjectEdition } from "@/lib/canvas/project-edition-detect";
import {
  isSbv1PipelineNodeType,
  isStoryPro2PipelineNodeType,
  isStoryProPipelineNodeType,
} from "@/lib/canvas/project-edition-detect";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import type { InsertMapResult } from "@/lib/canvas/project-asset-types";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeType,
} from "@/lib/canvas/types";
import { flowPositionAtViewportCenter } from "@/lib/canvas/viewport-placement";
import { canAddStoryNodeType } from "@/lib/canvas/story-edition-isolation";

export const CANVAS_PROJECT_ASSET_DRAG_MIME = "application/canvas-project-asset";

export type ProjectAssetDragPayload = {
  assetId: string;
  displayName?: string;
};

export function buildProjectAssetDragPayload(
  assetId: string,
  displayName?: string,
): string {
  return JSON.stringify({ assetId, displayName } satisfies ProjectAssetDragPayload);
}

export function parseProjectAssetDragPayload(
  dt: DataTransfer,
): ProjectAssetDragPayload | null {
  const raw = dt.getData(CANVAS_PROJECT_ASSET_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectAssetDragPayload;
    if (typeof parsed.assetId === "string" && parsed.assetId.trim()) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function detectCanvasEditionFromNodes(
  nodes: Array<{ type?: string | null }>,
): CanvasProjectEdition {
  for (const n of nodes) {
    if (isSbv1PipelineNodeType(n.type ?? "")) return "sbv1";
  }
  for (const n of nodes) {
    if (isStoryPro2PipelineNodeType(n.type ?? "")) return "pro2";
  }
  for (const n of nodes) {
    if (isStoryProPipelineNodeType(n.type ?? "")) return "pro";
  }
  return "standard";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function firstUrl(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = str(c);
    if (s.startsWith("http")) return s;
  }
  return "";
}

/** insert-map 字段 → 画布节点 data 字段 */
export function normalizeProjectAssetInsertData(
  nodeType: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };

  const mediaUrl = firstUrl(
    data.ossUrl,
    data.imageUrl,
    data.videoUrl,
    data.previewUrl,
    data.thumbnailUrl,
  );

  if (mediaUrl) {
    if (
      nodeType === "sbv1-video-engine" ||
      nodeType === "story-pro-video" ||
      nodeType === "story-pro2-video"
    ) {
      next.runtime = {
        ...(typeof data.runtime === "object" && data.runtime
          ? (data.runtime as Record<string, unknown>)
          : {}),
        ossUrl: mediaUrl,
        status: "succeeded",
      };
      next.videoUrl = mediaUrl;
    } else if (!str(next.ossUrl)) {
      next.ossUrl = mediaUrl;
    }
  }

  const label = str(data.label) || str(data.title);
  if (label) next.label = label;

  const dockPrompt =
    str(data.dockInput) ||
    str(data.prompt) ||
    str((data as { text?: string }).text);
  if (dockPrompt && !str(next.dockInput)) {
    next.dockInput = dockPrompt;
  }

  const outline =
    str(data.themeOutline) || str(data.outlineMd) || str(data.uploadedScriptMd);
  if (outline) {
    if (nodeType === "story-pro2-starter" && !str(next.generatedOutlineMd)) {
      next.generatedOutlineMd = outline;
    }
    if (nodeType === "story-pro-starter" && !str(next.uploadedScriptMd)) {
      next.uploadedScriptMd = outline;
    }
    if (
      (nodeType === "story-pro2-script-hub" ||
        nodeType === "story-pro-script-hub") &&
      !str(next.outlineMd)
    ) {
      next.outlineMd = outline;
    }
  }

  if (nodeType === "story-pro2-style-asset") {
    if (str(data.styleAnchorZh)) next.styleAnchorZh = data.styleAnchorZh;
    if (Array.isArray(data.refImageUrls)) next.refImageUrls = data.refImageUrls;
    if (mediaUrl && !str(next.imageUrl)) next.imageUrl = mediaUrl;
  }

  if (str(data.characterKey) && !str(next.characterKey)) {
    next.characterKey = data.characterKey;
  }

  if (
    nodeType === "story-pro2-three-view" &&
    !str(next.characterKey) &&
    str(next.label)
  ) {
    next.characterKey = str(next.label);
  }

  delete next.title;
  delete next.imageUrl;

  return next;
}

type BundleLayout = {
  nodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges?: Array<{ id: string; source: string; target: string }>;
};

export type SpawnProjectAssetActions = {
  getNodes: () => CanvasFlowNode[];
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: CanvasNodeType,
    groupId: string,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setEdges: (
    fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[],
  ) => void;
  setNodes: (
    fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
  ) => void;
};

function spawnSingleInsert(
  insert: InsertMapResult,
  position: { x: number; y: number },
  actions: SpawnProjectAssetActions,
): string {
  const nodeType = insert.nodeType as CanvasNodeType;
  const blocked = canAddStoryNodeType(nodeType, actions.getNodes());
  if (!blocked.ok) {
    throw new Error(blocked.message);
  }
  const data = normalizeProjectAssetInsertData(nodeType, insert.data ?? {});
  const style =
    insert.width && insert.height
      ? { width: insert.width, height: insert.height }
      : undefined;
  const id = actions.addNode(nodeType, position, data);
  if (!id) throw new Error("无法添加节点");
  if (style) {
    actions.setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              width: style.width,
              height: style.height,
              style: { ...(n.style ?? {}), ...style },
            }
          : n,
      ),
    );
  }
  return id;
}

function spawnGroupBundleInsert(
  insert: InsertMapResult,
  origin: { x: number; y: number },
  actions: SpawnProjectAssetActions,
): string {
  const layout = insert.data?.bundleLayout as BundleLayout | undefined;
  if (!layout?.nodes?.length) {
    return spawnSingleInsert(insert, origin, actions);
  }

  const blocked = canAddStoryNodeType("group", actions.getNodes());
  if (!blocked.ok) throw new Error(blocked.message);

  const groupData: Record<string, unknown> = {
    label: str(insert.data?.label) || "组资产",
  };
  if (insert.data?.pro2Kind) groupData.pro2Kind = insert.data.pro2Kind;
  if (insert.data?.sbv1Styled) groupData.sbv1Styled = insert.data.sbv1Styled;
  if (insert.data?.pro2Styled) groupData.pro2Styled = insert.data.pro2Styled;

  const groupId = actions.addNode("group", origin, groupData);
  if (!groupId) throw new Error("无法添加组节点");

  const idMap = new Map<string, string>();
  for (const child of layout.nodes) {
    const childType = child.type as CanvasNodeType;
    const childBlocked = canAddStoryNodeType(childType, actions.getNodes());
    if (!childBlocked.ok) continue;
    const childId = actions.addNodeInGroup(
      childType,
      groupId,
      child.position ?? { x: 0, y: 0 },
      normalizeProjectAssetInsertData(childType, child.data ?? {}),
    );
    if (childId) idMap.set(child.id, childId);
  }

  const newEdges: CanvasFlowEdge[] = [];
  for (const edge of layout.edges ?? []) {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) continue;
    newEdges.push({
      id: `e_${source}_${target}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source,
      target,
    });
  }
  if (newEdges.length) {
    actions.setEdges((prev) => [...prev, ...newEdges]);
  }

  return groupId;
}

export async function spawnProjectAssetOnCanvas(args: {
  base: string;
  assetId: string;
  edition: CanvasProjectEdition;
  position: { x: number; y: number };
  actions: SpawnProjectAssetActions;
  selectAfterSpawn?: boolean;
}): Promise<string> {
  if (args.assetId.startsWith("legacy:")) {
    throw new Error("旧版资产请先在对应节点面板管理，或运行迁移脚本后再插入画布。");
  }

  const insert = await mapProjectAssetInsert(args.base, args.assetId, args.edition);
  const isBundle =
    insert.nodeType === "group" &&
    Boolean(
      (insert.data?.bundleLayout as BundleLayout | undefined)?.nodes?.length,
    );

  const spawnedId = isBundle
    ? spawnGroupBundleInsert(insert, args.position, args.actions)
    : spawnSingleInsert(insert, args.position, args.actions);

  if (args.selectAfterSpawn !== false) {
    selectPro2NodeAfterSpawn(args.actions.setNodes, spawnedId);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
  }

  return spawnedId;
}

export async function spawnProjectAssetAtViewportCenter(args: {
  base: string;
  assetId: string;
  edition: CanvasProjectEdition;
  actions: SpawnProjectAssetActions;
  nodeTypeHint?: string;
}): Promise<string> {
  const position = flowPositionAtViewportCenter(
    (args.nodeTypeHint ?? "story-pro2-image") as CanvasNodeType,
  );
  return spawnProjectAssetOnCanvas({
    ...args,
    position,
  });
}

export type ProjectAssetCanvasInsertBridge = {
  insertAtPosition: (
    assetId: string,
    position: { x: number; y: number },
  ) => Promise<void>;
};

let canvasInsertBridge: ProjectAssetCanvasInsertBridge | null = null;

export function registerProjectAssetCanvasInsert(
  bridge: ProjectAssetCanvasInsertBridge | null,
): void {
  canvasInsertBridge = bridge;
}

export async function insertProjectAssetViaCanvasBridge(
  assetId: string,
  position: { x: number; y: number },
): Promise<boolean> {
  if (!canvasInsertBridge) return false;
  await canvasInsertBridge.insertAtPosition(assetId, position);
  return true;
}

export function isProjectAssetCanvasInsertAvailable(): boolean {
  return canvasInsertBridge !== null;
}
