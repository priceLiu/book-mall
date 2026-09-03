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
  isAbandonedCanvasInflightTask,
} from "./task-pick";
import { storyApplyTaskResult } from "./story-run-apply";
import { syncPro2SceneImagesFromRows } from "./pro2-spawn-scene-image-group";
import { syncPro2VideoBoardFromRows } from "./pro2-spawn-video-board-group";
import { syncPro2CharacterImagesFromRows } from "./pro2-spawn-character-image-group";
import { syncPro2FrameImagesFromRows } from "./pro2-spawn-frame-image-group";
import {
  reconcilePro2FrameNodesWithColumnRows,
  reconcilePro2ThreeViewNodesWithColumnRows,
} from "./pro2-group-row-resolve";
import type { StoryProSceneRow } from "./story-pro-workspace-types";
import type {
  StoryLlmSection,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import {
  isLibtvFreestandingImageNode,
  isPro2PipelineFrameCell,
  isPro2PipelineThreeViewCell,
} from "./libtv-image-node-run";
import {
  isSameSbv1MediaDataPatch,
  sbv1ImageFailurePatch,
  sbv1ImagePatchFromTask,
  sbv1VideoPatchFromTask,
} from "./sbv1-image-task-apply";
import { pickTaskResultMediaUrl } from "./task-media-url";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import {
  clearCanvasNodeRunSession,
  isCanvasNodeRunSessionActive,
  PRO2_SCRIPT_HUB_ORPHAN_RECONCILE_GRACE_MS,
  shouldDeferLibtvOrphanReconcile,
} from "./canvas-run-session";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { isStoryWorkspaceNodeType } from "./types";

function isInflightStatus(status?: string): boolean {
  return status === "queued" || status === "pending" || status === "running";
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
      !isStaleServerInflightTask(t, nodeTasks) &&
      !isAbandonedCanvasInflightTask(t),
  );
}

function rowHasMediaResult(runtime?: CanvasNodeRuntime): boolean {
  return Boolean(runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim());
}

/** 列行级任务刚入队 · task 列表尚未返回时勿清 inflight / 勿判失败 */
function shouldDeferStoryRowInflightReconcile(
  nodeId: string,
  runtime?: CanvasNodeRuntime,
): boolean {
  if (!isInflightStatus(runtime?.status)) return false;
  if (runtime?.taskId?.trim()) return false;
  return (
    shouldDeferLibtvOrphanReconcile(nodeId) ||
    isCanvasNodeRunSessionActive(nodeId)
  );
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

function hasServerInflightForNode(
  tasks: CanvasTaskRecord[],
  nodeId: string,
): boolean {
  const nodeTasks = tasks.filter((t) => t.nodeId === nodeId);
  return nodeTasks.some(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, nodeTasks) &&
      !isAbandonedCanvasInflightTask(t),
  );
}

function shouldDeferHubSectionOrphanClear(
  node: CanvasFlowNode,
  tasks: CanvasTaskRecord[],
): boolean {
  const extendedGrace =
    node.type === "story-pro2-script-hub" ||
    node.type === "story-pro-script-hub" ||
    node.type === "story-script-hub"
      ? PRO2_SCRIPT_HUB_ORPHAN_RECONCILE_GRACE_MS
      : undefined;
  if (shouldDeferLibtvOrphanReconcile(node.id, { extendedGraceMs: extendedGrace })) {
    return true;
  }
  if (isCanvasNodeRunSessionActive(node.id)) return true;
  if (hasServerInflightForNode(tasks, node.id)) return true;
  const d = node.data as { hubGenerateIntent?: boolean };
  if (d.hubGenerateIntent) return true;
  return false;
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
  const scope = { llmSection: section };
  const nodeTasks = tasks.filter((t) => t.nodeId === node.id);

  if (rt?.status === "error") {
    if (hasServerInflightForScope(tasks, node.id, scope)) {
      const pick = pickPreferredCanvasTaskForScope(
        nodeTasks,
        scope,
        rt,
        node.id,
      );
      if (pick && isServerInflightTaskStatus(pick.status)) {
        storyApplyTaskResult(
          node,
          pick,
          storyRunContextFromScope(node.id, scope),
          updateNodeData,
          allNodes,
        );
        return;
      }
    }
    const terminalPick = pickPreferredCanvasTaskForScope(
      nodeTasks,
      scope,
      rt,
      node.id,
    );
    if (
      terminalPick &&
      (terminalPick.status === "SUCCEEDED" ||
        terminalPick.status === "FAILED" ||
        terminalPick.status === "CANCELLED") &&
      !shouldSkipStoryRowTaskApply(rt, terminalPick, node.id)
    ) {
      storyApplyTaskResult(
        node,
        terminalPick,
        storyRunContextFromScope(node.id, scope),
        updateNodeData,
        allNodes,
      );
      return;
    }
  }

  if (!isInflightStatus(rt?.status)) return;

  if (hasServerInflightForScope(tasks, node.id, scope)) return;

  const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope, rt, node.id);
  if (pick) {
    if (shouldSkipStoryRowTaskApply(rt, pick, node.id)) return;
    storyApplyTaskResult(
      node,
      pick,
      storyRunContextFromScope(node.id, scope),
      updateNodeData,
      allNodes,
    );
    return;
  }

  if (rt?.status === "pending" && !rt?.taskId) {
    // 顺序链占位 / 乐观 pending：Gateway 仍在跑或会话未结束时勿清
    if (shouldDeferHubSectionOrphanClear(node, tasks)) return;
    return;
  }

  if (rt?.taskId && !nodeTasks.some((t) => t.id === rt.taskId)) {
    if (shouldDeferHubSectionOrphanClear(node, tasks)) return;
  }

  if (shouldDeferHubSectionOrphanClear(node, tasks)) return;

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
      node.type === "story-pro2-prompt" ||
      node.type === "story-pro-starter" ||
      (node.type === "story-pro2-script-hub" &&
        (node.data as { scriptStudioMode?: boolean }).scriptStudioMode === true)
    ) {
      const rt = (
        node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
      ).themeOutlineRuntime;
      if (isInflightStatus(rt?.status)) {
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
          const pick = pickPreferredCanvasTaskForScope(
            nodeTasks,
            scope,
            rt,
            node.id,
          );
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
          // 刚点击生成：任务尚未出现在 /tasks 时勿清乐观 pending（与图片节点同一宽限）
          if (shouldDeferLibtvOrphanReconcile(node.id)) continue;
          updateNodeData(node.id, {
            themeOutlineRuntime: clearInflightRuntime(rt),
          });
        }
      }
      continue;
    }

    if (isAnyStoryScriptHubType(node.type ?? "")) {
      // Hub 按 llmSection 分段 reconcile；勿因队列 skip 整节点（否则会漏写 SUCCEEDED）
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
        const scope = { rowKey: row.key, mediaKind: "threeView" as const };
        if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
          return row;
        }
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (hasServerInflightForScope(tasks, node.id, scope)) return row;
        const pick = pickStoryRowApplyTask(
          nodeTasks,
          scope,
          row.runtime,
        );
        if (pick) {
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick, node.id)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          } else if (!hasServerInflightForScope(tasks, node.id, scope)) {
            if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
              return row;
            }
            changed = true;
            return {
              ...row,
              runtime: clearInflightRuntime(row.runtime),
            };
          }
          return row;
        }
        if (
          rowHasMediaResult(row.runtime) &&
          !hasServerInflightForScope(tasks, node.id, scope)
        ) {
          changed = true;
          return {
            ...row,
            runtime: clearInflightRuntime(row.runtime),
          };
        }
        if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
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
        const nodesAfter = nodes.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, rows: nextRows } }
            : n,
        );
        syncPro2CharacterImagesFromRows(
          nodesAfter,
          node.id,
          nextRows as never,
          updateNodeData,
        );
        reconcilePro2ThreeViewNodesWithColumnRows(
          nodesAfter,
          node.id,
          updateNodeData,
        );
      }
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
        const pick = pickStoryRowApplyTask(
          nodeTasks,
          scope,
          row.runtime,
        );
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
        const scope = { rowKey: row.key, mediaKind: "frameImage" as const };
        if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
          return row;
        }
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (hasServerInflightForScope(tasks, node.id, scope)) return row;
        const pick = pickStoryRowApplyTask(
          nodeTasks,
          scope,
          row.runtime,
        );
        if (pick) {
          if (!shouldSkipStoryRowTaskApply(row.runtime, pick, node.id)) {
            storyApplyTaskResult(
              node,
              pick,
              storyRunContextFromScope(node.id, scope),
              updateNodeData,
              nodes,
            );
          } else if (!hasServerInflightForScope(tasks, node.id, scope)) {
            if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
              return row;
            }
            changed = true;
            return {
              ...row,
              runtime: clearInflightRuntime(row.runtime),
            };
          }
          return row;
        }
        if (
          rowHasMediaResult(row.runtime) &&
          !hasServerInflightForScope(tasks, node.id, scope)
        ) {
          changed = true;
          return {
            ...row,
            runtime: clearInflightRuntime(row.runtime),
          };
        }
        if (shouldDeferStoryRowInflightReconcile(node.id, row.runtime)) {
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
        const nodesAfter = nodes.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, rows: nextRows } }
            : n,
        );
        syncPro2FrameImagesFromRows(
          nodesAfter,
          node.id,
          nextRows as never,
          updateNodeData,
        );
        reconcilePro2FrameNodesWithColumnRows(
          nodesAfter,
          node.id,
          updateNodeData,
        );
      }
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
            const pick = pickPreferredCanvasTaskForScope(
              nodeTasks,
              scope,
              rt,
              node.id,
            );
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

    /** 组内三视图/分镜格由列 reconcile；勿按独立 media 节点判 orphan 失败 */
    if (isPro2PipelineThreeViewCell(node) || isPro2PipelineFrameCell(node)) {
      continue;
    }

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
      if (
        shouldDeferLibtvOrphanReconcile(node.id) ||
        isCanvasNodeRunSessionActive(node.id)
      ) {
        continue;
      }
    }

    const pick = pickPreferredCanvasTask(nodeTasks, { localRuntime: rt });
    if (pick && (pick.status === "SUCCEEDED" || pick.status === "FAILED")) {
      if (isStoryWorkspaceNodeType(node.type ?? "")) {
        storyApplyTaskResult(
          node,
          pick,
          storyRunContextFromScope(node.id, {}),
          updateNodeData,
          nodes,
        );
      } else if (isLibtvFreestandingImageNode(node) || node.type === "sbv1-video-engine") {
        const imagePatch =
          node.type === "sbv1-video-engine"
            ? sbv1VideoPatchFromTask(pick)
            : sbv1ImagePatchFromTask(
                node.data as unknown as Sbv1ImageNodeData,
                pick,
              );
        const patch = imagePatch ?? runtimePatchFromCanvasTask(pick);
        if (imagePatch && !isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, imagePatch)) {
          clearCanvasNodeRunSession(node.id);
          updateNodeData(node.id, imagePatch);
        } else if (patch && shouldApplyCanvasTaskRuntimePatch(rt, pick, patch, node.id)) {
          if (isLibtvFreestandingImageNode(node) && pick.status === "SUCCEEDED") {
            const mediaUrl = pickTaskResultMediaUrl(pick) ?? pick.ossUrl ?? undefined;
            updateNodeData(node.id, {
              uploading: false,
              ossUrl: mediaUrl,
              blobUrl: undefined,
              runtime: patch,
            });
          } else {
            setNodeRuntime(node.id, patch);
          }
        }
      } else {
        const patch = runtimePatchFromCanvasTask(pick);
        if (patch && shouldApplyCanvasTaskRuntimePatch(rt, pick, patch, node.id)) {
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
