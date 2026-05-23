/**
 * canvas v2 · 从模板克隆 graph 并重分配 nodeId / edgeId。
 *
 * 用于「从模板新建画布」与「复用已有工作流」：避免 nodeId 在不同 project 之间撞车。
 * 顺手清理一遍 runtime（再保险）。
 */

import { nanoid } from "nanoid";
import { stripRuntimeForTemplate } from "./sanitize";
import type { CanvasGraph } from "./types";

export function cloneGraphForNewProject(src: CanvasGraph): CanvasGraph {
  const cleaned = stripRuntimeForTemplate(src);
  const idMap = new Map<string, string>();
  const nodes = cleaned.nodes.map((n) => {
    const newId = `n_${nanoid(8)}`;
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });
  const edges = cleaned.edges.map((e) => ({
    ...e,
    id: `e_${nanoid(8)}`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));
  return {
    ...cleaned,
    nodes,
    edges,
  };
}
