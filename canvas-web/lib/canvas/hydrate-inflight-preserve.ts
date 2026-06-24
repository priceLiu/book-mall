import { isCanvasInflightStatus } from "./story-column-runtime";
import type {
  CanvasFlowNode,
  CanvasNodeRuntime,
} from "./types";

type RowLike = {
  key?: string;
  runtime?: CanvasNodeRuntime;
  videoRuntime?: CanvasNodeRuntime;
  ttsRuntime?: CanvasNodeRuntime;
};

const HUB_RUNTIME_KEYS = [
  "outlineRuntime",
  "characterRuntime",
  "sceneRuntime",
  "storyboardRuntime",
] as const;

function copyInflightRuntime(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  key: string,
): boolean {
  const prevRt = prev[key] as CanvasNodeRuntime | undefined;
  if (!prevRt || !isCanvasInflightStatus(prevRt.status)) return false;
  next[key] = prevRt;
  return true;
}

function preserveRowInflight(prevRows: RowLike[], nextRows: RowLike[]): RowLike[] {
  const prevByKey = new Map(
    prevRows.filter((r) => r.key).map((r) => [r.key!, r]),
  );
  return nextRows.map((row) => {
    const key = row.key;
    if (!key) return row;
    const prev = prevByKey.get(key);
    if (!prev) return row;
    let changed = false;
    const merged: RowLike = { ...row };
    for (const rtKey of ["runtime", "videoRuntime", "ttsRuntime"] as const) {
      const prevRt = prev[rtKey];
      if (prevRt && isCanvasInflightStatus(prevRt.status)) {
        merged[rtKey] = prevRt;
        changed = true;
      }
    }
    return changed ? merged : row;
  });
}

/** hydrate 二次布局会整表替换 nodes；保留用户已触发的本地 pending/running 态。 */
export function preserveLocalInflightOnHydrateLayout(
  prevNodes: CanvasFlowNode[],
  nextNodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  return nextNodes.map((node) => {
    const prev = prevById.get(node.id);
    if (!prev) return node;
    const prevData = prev.data as Record<string, unknown>;
    const nextData = { ...(node.data as Record<string, unknown>) };
    let changed = false;

    if (copyInflightRuntime(prevData, nextData, "runtime")) changed = true;
    if (copyInflightRuntime(prevData, nextData, "themeOutlineRuntime")) {
      changed = true;
    }
    for (const key of HUB_RUNTIME_KEYS) {
      if (copyInflightRuntime(prevData, nextData, key)) changed = true;
    }

    const prevRows = prevData.rows;
    const nextRows = nextData.rows;
    if (Array.isArray(prevRows) && Array.isArray(nextRows)) {
      const mergedRows = preserveRowInflight(
        prevRows as RowLike[],
        nextRows as RowLike[],
      );
      for (let i = 0; i < mergedRows.length; i++) {
        if (mergedRows[i] !== (nextRows as RowLike[])[i]) {
          nextData.rows = mergedRows;
          changed = true;
          break;
        }
      }
    }

    return changed
      ? { ...node, data: nextData as CanvasFlowNode["data"] }
      : node;
  });
}
