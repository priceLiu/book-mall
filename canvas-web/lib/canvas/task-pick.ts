import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { CanvasStoryRunJob } from "./canvas-run-bus";
import type { StoryRunContext } from "./story-workspace-types";
import { pickTaskResultMediaUrl } from "./task-media-url";

export type CanvasTaskStoryScope = {
  rowKey?: string;
  mediaKind?: string;
  llmSection?: string;
};

export function taskStoryScope(
  task: Pick<CanvasTaskRecord, "storyScope">,
): CanvasTaskStoryScope | undefined {
  return task.storyScope;
}

/** 漫剧列行级任务：按 storyScope 过滤，避免同节点多行时 pick 到其它行的历史成功任务 */
export function tasksMatchStoryScope(
  task: CanvasTaskRecord,
  scope: CanvasTaskStoryScope,
): boolean {
  const t = taskStoryScope(task);
  if (!t) return false;
  if (scope.rowKey && t.rowKey !== scope.rowKey) return false;
  if (scope.mediaKind && t.mediaKind !== scope.mediaKind) return false;
  if (scope.llmSection && t.llmSection !== scope.llmSection) return false;
  return true;
}

export function pickPreferredCanvasTaskForScope(
  tasks: CanvasTaskRecord[],
  scope: CanvasTaskStoryScope,
): CanvasTaskRecord | undefined {
  const scoped = tasks.filter((t) => tasksMatchStoryScope(t, scope));
  return pickPreferredCanvasTask(scoped);
}

export function storyRunContextFromScope(
  nodeId: string,
  scope: CanvasTaskStoryScope,
): CanvasStoryRunJob {
  return {
    nodeId,
    rowKey: scope.rowKey,
    mediaKind: scope.mediaKind as StoryRunContext["mediaKind"],
    llmSection: scope.llmSection as StoryRunContext["llmSection"],
  };
}

function taskDisplayRank(t: CanvasTaskRecord): number {
  if (t.status === "SUCCEEDED" && (t.textOutput || pickTaskResultMediaUrl(t))) {
    return 4;
  }
  if (t.status === "SUBMITTED" || t.status === "PENDING") return 3;
  if (t.status === "SUCCEEDED") return 2;
  if (t.status === "FAILED") return 1;
  return 0;
}

/** 同一节点多条任务时：优先展示成功且有结果，其次进行中，最后才用失败记录。 */
export function pickPreferredCanvasTask(
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord | undefined {
  if (!tasks.length) return undefined;
  return [...tasks].sort((a, b) => {
    const rankDiff = taskDisplayRank(b) - taskDisplayRank(a);
    if (rankDiff !== 0) return rankDiff;
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  })[0];
}

export function preferredTasksByNode(
  tasks: CanvasTaskRecord[],
): Map<string, CanvasTaskRecord> {
  const grouped = new Map<string, CanvasTaskRecord[]>();
  for (const t of tasks) {
    const list = grouped.get(t.nodeId) ?? [];
    list.push(t);
    grouped.set(t.nodeId, list);
  }
  const out = new Map<string, CanvasTaskRecord>();
  for (const [nodeId, list] of Array.from(grouped.entries())) {
    const pick = pickPreferredCanvasTask(list);
    if (pick) out.set(nodeId, pick);
  }
  return out;
}

/** 同镜多个 video-engine 时，用任意节点上的成功任务补回缺失/失败 runtime。 */
export function backfillFrameVideoRuntimesFromTasks(
  nodes: CanvasFlowNode[],
  tasks: CanvasTaskRecord[],
  setNodeRuntime: (nodeId: string, patch: Partial<CanvasNodeRuntime>) => void,
): void {
  const videoNodes = nodes.filter((n) => n.type === "video-engine");
  const byFrame = new Map<number, CanvasFlowNode[]>();
  for (const n of videoNodes) {
    const fi = (n.data as { frameIndex?: number }).frameIndex;
    if (fi == null) continue;
    const list = byFrame.get(fi) ?? [];
    list.push(n);
    byFrame.set(fi, list);
  }

  for (const group of Array.from(byFrame.values())) {
    let bestTask: CanvasTaskRecord | undefined;
    for (const node of group) {
      const pick = pickPreferredCanvasTask(
        tasks.filter((t) => t.nodeId === node.id),
      );
      if (pick?.status !== "SUCCEEDED") continue;
      const url = pickTaskResultMediaUrl(pick);
      if (!url && !pick.textOutput) continue;
      if (
        !bestTask ||
        new Date(pick.updatedAt).getTime() >
          new Date(bestTask.updatedAt).getTime()
      ) {
        bestTask = pick;
      }
    }
    if (!bestTask) continue;
    const url = pickTaskResultMediaUrl(bestTask);
    if (!url) continue;

    for (const node of group) {
      const rt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
      if (rt?.status === "done" && (rt.ossUrl || rt.ephemeralUrl)) continue;
      setNodeRuntime(node.id, {
        status: "done",
        taskId: bestTask.id,
        ossUrl: url,
        ephemeralUrl: bestTask.ephemeralUrl ?? undefined,
      });
    }
  }
}
