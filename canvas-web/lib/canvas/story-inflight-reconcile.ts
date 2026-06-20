"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { hubSectionMd } from "./story-hub-runtime";
import {
  isAnyStoryCharacterColumnType,
  isAnyStoryFrameColumnType,
  isAnyStorySceneColumnType,
  isAnyStoryScriptHubType,
  isAnyStoryVideoColumnType,
} from "./story-workspace-resolver";
import {
  pickPreferredCanvasTask,
  pickPreferredCanvasTaskForScope,
  runtimePatchFromCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  storyRunContextFromScope,
  tasksMatchStoryScope,
  type CanvasTaskStoryScope,
  shouldSkipStoryRowTaskApply,
  isServerInflightTaskStatus,
} from "./task-pick";
import { storyApplyTaskResult } from "./story-run-apply";
import { syncPro2SceneImagesFromRows } from "./pro2-spawn-scene-image-group";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type {
  StoryLlmSection,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { isStoryWorkspaceNodeType } from "./types";

function isInflightStatus(status?: string): boolean {
  return status === "pending" || status === "running";
}

function hasServerInflightForScope(
  tasks: CanvasTaskRecord[],
  nodeId: string,
  scope: CanvasTaskStoryScope,
): boolean {
  return tasks.some(
    (t) =>
      t.nodeId === nodeId &&
      tasksMatchStoryScope(t, scope) &&
      isServerInflightTaskStatus(t.status),
  );
}

function rowHasMediaResult(runtime?: CanvasNodeRuntime): boolean {
  return Boolean(runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim());
}

function clearInflightRuntime(
  runtime: CanvasNodeRuntime | undefined,
): CanvasNodeRuntime {
  const base = runtime ?? { status: "idle" };
  if (rowHasMediaResult(base)) {
    return {
      ...base,
      status: "done",
      failCode: undefined,
      failMessage: undefined,
    };
  }
  return {
    ...base,
    status: "idle",
    taskId: undefined,
    failCode: undefined,
    failMessage: undefined,
  };
}

function reconcileHubSection(
  node: CanvasFlowNode,
  section: StoryLlmSection,
  tasks: CanvasTaskRecord[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  allNodes: CanvasFlowNode[],
): void {
  const d = node.data as unknown as StoryScriptHubNodeData;
  const rtKey =
    section === "outline"
      ? "outlineRuntime"
      : section === "character"
        ? "characterRuntime"
        : section === "scene"
          ? "sceneRuntime"
          : "storyboardRuntime";
  const rt = d[rtKey as keyof StoryScriptHubNodeData] as
    | CanvasNodeRuntime
    | undefined;
  if (!isInflightStatus(rt?.status)) return;

  const scope = { llmSection: section };
  const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
  if (hasServerInflightForScope(tasks, node.id, scope)) return;

  const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
  if (pick) {
    storyApplyTaskResult(
      node,
      pick,
      storyRunContextFromScope(node.id, scope),
      updateNodeData,
      allNodes,
    );
    return;
  }

  if (rt?.taskId && !nodeTasks.some((t) => t.id === rt.taskId)) {
    return;
  }

  const md = hubSectionMd(node, section);
  updateNodeData(node.id, {
    [rtKey]: clearInflightRuntime(
      md.trim() ? { ...rt, status: "done" } : rt,
    ),
  });
}

/**
 * 服务端已无进行中任务、但本地仍显示 pending/running 时（如进程重启后 autosave 残留），
 * 按任务终态或已有结果回写 idle/done/error。
 */
export function reconcileStaleInflightRuntimes(
  nodes: CanvasFlowNode[],
  tasks: CanvasTaskRecord[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  setNodeRuntime: (id: string, patch: Partial<CanvasNodeRuntime>) => void,
  opts?: { skipNodeIds?: ReadonlySet<string> },
): void {
  const skipNodeIds = opts?.skipNodeIds;
  for (const node of nodes) {
    if (node.type === "story-pro2-starter" || node.type === "story-pro-starter") {
      const rt = (
        node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
      ).themeOutlineRuntime;
      if (isInflightStatus(rt?.status)) {
        const scope = { mediaKind: "themeOutline" };
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (!hasServerInflightForScope(tasks, node.id, scope)) {
          const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
          if (pick) {
            if (!shouldSkipStoryRowTaskApply(rt, pick)) {
              storyApplyTaskResult(
                node,
                pick,
                storyRunContextFromScope(node.id, scope),
                updateNodeData,
                nodes,
              );
            }
          } else {
            updateNodeData(node.id, {
              themeOutlineRuntime: clearInflightRuntime(rt),
            });
          }
        }
      }
      continue;
    }

    if (isAnyStoryScriptHubType(node.type ?? "")) {
      if (skipNodeIds?.has(node.id)) continue;
      for (const section of ["outline", "character", "scene", "storyboard"] as const) {
        reconcileHubSection(node, section, tasks, updateNodeData, nodes);
      }
      continue;
    }

    if (isAnyStoryCharacterColumnType(node.type ?? "")) {
      const rows =
        (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
          .rows ?? [];
      let changed = false;
      const nextRows = rows.map((row) => {
        if (!isInflightStatus(row.runtime?.status)) return row;
        const scope = { rowKey: row.key, mediaKind: "threeView" };
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (hasServerInflightForScope(tasks, node.id, scope)) return row;
        const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
        if (pick) {
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          }
          return row;
        }
        changed = true;
        return {
          ...row,
          runtime: clearInflightRuntime(row.runtime),
        };
      });
      if (changed) updateNodeData(node.id, { rows: nextRows });
      continue;
    }

    if (isAnyStorySceneColumnType(node.type ?? "")) {
      const rows =
        (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
          .rows ?? [];
      let changed = false;
      const nextRows = rows.map((row) => {
        if (!isInflightStatus(row.runtime?.status)) return row;
        const scope = { rowKey: row.key, mediaKind: "sceneRef" };
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (hasServerInflightForScope(tasks, node.id, scope)) return row;
        const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
        if (pick) {
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          }
          return row;
        }
        changed = true;
        return {
          ...row,
          runtime: clearInflightRuntime(row.runtime),
        };
      });
      if (changed) {
        updateNodeData(node.id, { rows: nextRows });
        syncPro2SceneImagesFromRows(
          nodes.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, rows: nextRows } }
              : n,
          ),
          node.id,
          nextRows as StoryProSceneRow[],
          updateNodeData,
        );
      }
      continue;
    }

    if (isAnyStoryFrameColumnType(node.type ?? "")) {
      const rows =
        (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
          .rows ?? [];
      let changed = false;
      const nextRows = rows.map((row) => {
        if (!isInflightStatus(row.runtime?.status)) return row;
        const scope = { rowKey: row.key, mediaKind: "frameImage" };
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (hasServerInflightForScope(tasks, node.id, scope)) return row;
        const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
        if (pick) {
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          }
          return row;
        }
        changed = true;
        return {
          ...row,
          runtime: clearInflightRuntime(row.runtime),
        };
      });
      if (changed) updateNodeData(node.id, { rows: nextRows });
      continue;
    }

    if (isAnyStoryVideoColumnType(node.type ?? "")) {
      const rows =
        (node.data as {
          rows?: {
            key: string;
            videoRuntime?: CanvasNodeRuntime;
            ttsRuntime?: CanvasNodeRuntime;
          }[];
        }).rows ?? [];
      let changed = false;
      const nextRows = rows.map((row) => {
        let next = row;
        for (const mediaKind of ["video", "tts"] as const) {
          const rtKey = mediaKind === "tts" ? "ttsRuntime" : "videoRuntime";
          const rt = row[rtKey];
          const scope = { rowKey: row.key, mediaKind };
          const nodeTasks = tasks.filter((t) => t.nodeId === node.id);

          if (rt?.status === "error" && hasServerInflightForScope(tasks, node.id, scope)) {
            const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
            if (pick && isServerInflightTaskStatus(pick.status)) {
              storyApplyTaskResult(
                node,
                pick,
                storyRunContextFromScope(node.id, scope),
                updateNodeData,
                nodes,
              );
              continue;
            }
          }

          if (!isInflightStatus(rt?.status)) continue;
          if (hasServerInflightForScope(tasks, node.id, scope)) continue;
          const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
          if (pick) {
            if (!shouldSkipStoryRowTaskApply(rt, pick)) {
              storyApplyTaskResult(
                node,
                pick,
                storyRunContextFromScope(node.id, scope),
                updateNodeData,
                nodes,
              );
            }
            continue;
          }
          changed = true;
          next = {
            ...next,
            [rtKey]: clearInflightRuntime(rt),
          };
        }
        return next;
      });
      if (changed) updateNodeData(node.id, { rows: nextRows });
      continue;
    }

    if (isStoryWorkspaceNodeType(node.type ?? "")) continue;

    if (skipNodeIds?.has(node.id)) continue;

    const rt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
    if (!rt || !isInflightStatus(rt.status)) continue;

    const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
    const inflight = nodeTasks.some(
      (t) => isServerInflightTaskStatus(t.status),
    );
    if (inflight) continue;

    // 刚提交：本地 pending/running 尚未绑定 taskId，勿误清或误贴历史终态
    if (!rt.taskId) {
      continue;
    }

    // 刚提交：本地已绑定 taskId，列表可能尚未返回该任务
    if (rt.taskId && !nodeTasks.some((t) => t.id === rt.taskId)) {
      continue;
    }

    const pick = pickPreferredCanvasTask(nodeTasks);
    if (pick && (pick.status === "SUCCEEDED" || pick.status === "FAILED")) {
      if (isStoryWorkspaceNodeType(node.type ?? "")) {
        storyApplyTaskResult(
          node,
          pick,
          storyRunContextFromScope(node.id, {}),
          updateNodeData,
          nodes,
        );
      } else {
        const patch = runtimePatchFromCanvasTask(pick);
        const localRt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
        if (patch && shouldApplyCanvasTaskRuntimePatch(localRt, pick, patch)) {
          setNodeRuntime(node.id, patch);
        }
      }
      continue;
    }

    setNodeRuntime(node.id, clearInflightRuntime(rt));
  }
}
