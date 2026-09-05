import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 连线后默认写入的文本节点标题（用户可双击改为其它名称） */
export const PRO2_AUTO_OUTLINE_LABEL = "故事大纲";

const STARTER_CONTENT_KEYS = [
  "themeInput",
  "generatedOutlineMd",
  "uploadedScriptMd",
  "uploadedScriptMeta",
] as const;

export type Pro2StarterLinkData = {
  label?: string;
  pro2TextPurpose?: string;
  workspaceIds?: { scriptHubId?: string; [key: string]: unknown };
};

function isAutoOutlineLabel(label: string | undefined): boolean {
  const t = label?.trim();
  return !t || t === PRO2_AUTO_OUTLINE_LABEL;
}

/** 文本节点 ↔ 故事剧本 hub 连线：标记 story-outline 并写入默认标题（保留用户自定义标题） */
export function patchPro2StarterOnScriptHubLink(
  existing: Pro2StarterLinkData,
  scriptHubId: string,
): Record<string, unknown> {
  const ws = { ...(existing.workspaceIds ?? {}), scriptHubId };
  const patch: Record<string, unknown> = {
    pro2TextPurpose: "story-outline",
    workspaceIds: ws,
  };
  if (isAutoOutlineLabel(existing.label)) {
    patch.label = PRO2_AUTO_OUTLINE_LABEL;
  }
  return patch;
}

/** 故事剧本 hub 删除或断开连线：恢复 general；清除自动标题「故事大纲」 */
export function patchPro2StarterOnScriptHubUnlink(
  existing: Pro2StarterLinkData,
): Record<string, unknown> {
  const ws = { ...(existing.workspaceIds ?? {}) };
  delete ws.scriptHubId;
  const patch: Record<string, unknown> = {
    pro2TextPurpose: "general",
    workspaceIds: ws,
  };
  if (
    existing.pro2TextPurpose === "story-outline" ||
    isAutoOutlineLabel(existing.label)
  ) {
    patch.label = undefined;
  }
  return patch;
}

/** 切换剧本类别 preset 时合并 starter patch：不覆盖已有正文 / 大纲内容；保留用户自定义标题 */
export function mergePro2CategoryStarterPatch(
  existing: Record<string, unknown> | undefined,
  starterPatch: Record<string, unknown>,
  opts: { isNewSpawn: boolean },
): Record<string, unknown> {
  if (opts.isNewSpawn) return { ...starterPatch };

  const merged: Record<string, unknown> = { ...starterPatch };
  for (const key of STARTER_CONTENT_KEYS) {
    delete merged[key];
  }

  const label = String(existing?.label ?? "").trim();
  if (label && label !== PRO2_AUTO_OUTLINE_LABEL) {
    delete merged.label;
  }

  return merged;
}

export function findPro2StartersLinkedToHub(
  hubId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string[] {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.target !== hubId && e.source !== hubId) continue;
    const starterId = e.target === hubId ? e.source : e.target;
    const starter = nodes.find((n) => n.id === starterId);
    if (starter?.type === "story-pro2-starter") ids.add(starterId);
  }
  for (const n of nodes) {
    if (n.type !== "story-pro2-starter") continue;
    const ws = (n.data as Pro2StarterLinkData).workspaceIds;
    if (ws?.scriptHubId === hubId) ids.add(n.id);
  }
  return [...ids];
}

export function starterStillLinkedToAnyScriptHub(
  starterId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): boolean {
  for (const e of edges) {
    if (e.source !== starterId && e.target !== starterId) continue;
    const otherId = e.source === starterId ? e.target : e.source;
    const other = nodes.find((n) => n.id === otherId);
    if (other?.type === "story-pro2-script-hub") return true;
  }
  return false;
}

export function isPro2StarterScriptHubEdge(
  edge: Pick<CanvasFlowEdge, "source" | "target">,
  nodes: CanvasFlowNode[],
): boolean {
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  return (
    (src?.type === "story-pro2-starter" &&
      tgt?.type === "story-pro2-script-hub") ||
    (src?.type === "story-pro2-script-hub" &&
      tgt?.type === "story-pro2-starter")
  );
}

export function resolvePro2StarterFromScriptHubEdge(
  edge: Pick<CanvasFlowEdge, "source" | "target">,
  nodes: CanvasFlowNode[],
): string | null {
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  if (src?.type === "story-pro2-starter") return src.id;
  if (tgt?.type === "story-pro2-starter") return tgt.id;
  return null;
}

/** 连线被移除后（剪断 / Delete / setEdges）收集需还原的文本节点 patch */
export function collectPro2StarterUnlinkPatches(
  removedEdges: CanvasFlowEdge[],
  nodes: CanvasFlowNode[],
  remainingEdges: CanvasFlowEdge[],
): Map<string, Record<string, unknown>> {
  const patches = new Map<string, Record<string, unknown>>();
  for (const edge of removedEdges) {
    if (!isPro2StarterScriptHubEdge(edge, nodes)) continue;
    const starterId = resolvePro2StarterFromScriptHubEdge(edge, nodes);
    if (!starterId || patches.has(starterId)) continue;
    if (starterStillLinkedToAnyScriptHub(starterId, nodes, remainingEdges)) {
      continue;
    }
    const starter = nodes.find((n) => n.id === starterId);
    if (!starter || starter.type !== "story-pro2-starter") continue;
    patches.set(
      starterId,
      patchPro2StarterOnScriptHubUnlink(
        starter.data as Pro2StarterLinkData,
      ),
    );
  }
  return patches;
}

function applyStarterPatchesToNodes(
  nodes: CanvasFlowNode[],
  patches: Map<string, Record<string, unknown>>,
): CanvasFlowNode[] {
  if (patches.size === 0) return nodes;
  return nodes.map((n) => {
    const patch = patches.get(n.id);
    if (!patch) return n;
    return {
      ...n,
      data: { ...(n.data as Record<string, unknown>), ...patch },
    };
  });
}

export function applyPro2StarterUnlinkAfterEdgeRemoval(
  nodes: CanvasFlowNode[],
  prevEdges: CanvasFlowEdge[],
  nextEdges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const removed = prevEdges.filter(
    (e) => !nextEdges.some((ne) => ne.id === e.id),
  );
  if (!removed.length) return nodes;
  const patches = collectPro2StarterUnlinkPatches(removed, nodes, nextEdges);
  return applyStarterPatchesToNodes(nodes, patches);
}
