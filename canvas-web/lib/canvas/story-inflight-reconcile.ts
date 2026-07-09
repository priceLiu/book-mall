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
  pickStoryRowApplyTask,
  runtimePatchFromCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  storyRunContextFromScope,
  tasksMatchStoryScope,
  type CanvasTaskStoryScope,
  shouldSkipStoryRowTaskApply,
  isServerInflightTaskStatus,
  isStaleServerInflightTask,
} from "./task-pick";
import { storyApplyTaskResult } from "./story-run-apply";
import { syncPro2SceneImagesFromRows } from "./pro2-spawn-scene-image-group";
import { syncPro2VideoBoardFromRows } from "./pro2-spawn-video-board-group";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type {
  StoryLlmSection,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import {
  isLibtvFreestandingImageNode,
} from "./libtv-image-node-run";
import {
  isSameSbv1MediaDataPatch,
  sbv1ImageFailurePatch,
  sbv1ImagePatchFromTask,
} from "./sbv1-image-task-apply";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import {
  clearCanvasNodeRunSession,
  shouldDeferLibtvOrphanReconcile,
} from "./canvas-run-session";
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
  const nodeTasks = tasks.filter((t) => t.nodeId === nodeId);
  return nodeTasks.some(
    (t) =>
      tasksMatchStoryScope(t, scope) &&
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, nodeTasks),
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
  if (rt?.status === "pending" && !rt?.taskId) return;

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
    if (
      node.type === "story-pro2-starter" ||
      node.type === "story-pro-starter" ||
      (node.type === "story-pro2-script-hub" &&
        (node.data as { scriptStudioMode?: boolean }).scriptStudioMode === true)
    ) {
      const rt = (
        node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
      ).themeOutlineRuntime;
      if (isInflightStatus(rt?.status)) {
        if (rt?.status === "pending" && !rt?.taskId) continue;
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        const scopes = [
          { mediaKind: "themeOutline" as const },
          { mediaKind: "generalText" as const },
        ];
        const serverInflight = scopes.some((scope) =>
          hasServerInflightForScope(tasks, node.id, scope),
        );
        if (serverInflight) continue;
        let applied = false;
        for (const scope of scopes) {
          const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
          if (!pick) continue;
          if (!shouldSkipStoryRowTaskApply(rt, pick, node.id)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          }
          applied = true;
          break;
        }
        if (!applied) {
          updateNodeData(node.id, {
            themeOutlineRuntime: clearInflightRuntime(rt),
          });
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
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick, node.id)) {
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
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick, node.id)) {
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
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick, node.id)) {
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
          const pick = pickStoryRowApplyTask(nodeTasks, scope, rt);
          if (pick) {
            if (!shouldSkipStoryRowTaskApply(rt, pick, node.id)) {
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
      if (changed) {
        updateNodeData(node.id, { rows: nextRows });
        syncPro2VideoBoardFromRows(
          nodes.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, rows: nextRows } }
              : n,
          ),
          node.id,
          nextRows as never,
          updateNodeData,
        );
      }
      continue;
    }

    if (isStoryWorkspaceNodeType(node.type ?? "")) continue;

    if (skipNodeIds?.has(node.id)) continue;

    const rt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
    if (!rt || !isInflightStatus(rt.status)) continue;

    const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
    const inflight = nodeTasks.some(
      (t) =>
        isServerInflightTaskStatus(t.status) &&
        !isStaleServerInflightTask(t, nodeTasks),
    );
    if (inflight) continue;

    // 刚提交：本地 pending/running 尚未绑定 taskId，勿误贴历史终态；
    // 但若服务端无进行中任务且本地队列也未跑，则为落库的孤儿乐观态，应清除。
    if (!rt.taskId) {
      if (
        !skipNodeIds?.has(node.id) &&
        (isLibtvFreestandingImageNode(node) ||
          node.type === "sbv1-video-engine")
      ) {
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        const hasServerInflight = nodeTasks.some(
          (t) =>
            isServerInflightTaskStatus(t.status) &&
            !isStaleServerInflightTask(t, nodeTasks),
        );
        if (!hasServerInflight) {
          if (shouldDeferLibtvOrphanReconcile(node.id)) {
            continue;
          }
          const terminalPick = pickPreferredCanvasTask(nodeTasks);
          if (
            terminalPick &&
            (terminalPick.status === "FAILED" ||
              terminalPick.status === "CANCELLED")
          ) {
            const patch = sbv1ImagePatchFromTask(
              node.data as unknown as Sbv1ImageNodeData,
              terminalPick,
            );
            if (
              patch &&
              !isSameSbv1MediaDataPatch(
                node.data as Record<string, unknown>,
                patch,
              )
            ) {
              clearCanvasNodeRunSession(node.id);
              updateNodeData(node.id, patch);
            }
            continue;
          }
          clearCanvasNodeRunSession(node.id);
          updateNodeData(
            node.id,
            sbv1ImageFailurePatch(
              "RUN_STALE",
              "生成未完成（服务端无进行中的任务）。请重试；若仍失败请查看 Gateway 状态或联系管理员。",
            ),
          );
        }
      }
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
        if (patch && shouldApplyCanvasTaskRuntimePatch(localRt, pick, patch, node.id)) {
          setNodeRuntime(node.id, patch);
        }
      }
      continue;
    }

    if (rowHasMediaResult(rt)) {
      setNodeRuntime(node.id, clearInflightRuntime(rt));
    } else {
      setNodeRuntime(node.id, {
        status: "error",
        taskId: rt.taskId,
        failCode: "RUN_STALE",
        failMessage:
          "生成未完成（服务端无进行中的任务）。请重试；若仍失败请查看 Gateway 状态或联系管理员。",
      });
    }
  }
}
