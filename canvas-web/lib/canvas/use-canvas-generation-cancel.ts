"use client";

import { useCallback } from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  busCancelCanvasGeneration,
  type CanvasCancelGenerationJob,
} from "./canvas-run-bus";
import {
  GENERATION_CANCEL_CONFIRM_MESSAGE,
  GENERATION_CANCEL_CONFIRM_TITLE,
} from "./canvas-generation-cancel-messages";
import { hubSectionRuntime } from "./story-hub-runtime";
import { isCanvasInflightStatus } from "./story-column-runtime";
import {
  isAnyStoryScriptHubType,
} from "./story-workspace-resolver";
import { isPro2StoryOutlineTextNode } from "./pro2-text-purpose";
import { useCanvasStore } from "./store";
import type { CanvasFlowNode } from "./types";
import { resolvePro2BoardRowCancelScope } from "./use-canvas-generation-cancel-scope";

const HUB_SECTIONS = ["outline", "character", "scene", "storyboard"] as const;

function resolveStarterCancelScope(
  node: CanvasFlowNode,
): Pick<CanvasCancelGenerationJob, "mediaKind"> {
  if (
    (node.type === "story-pro2-starter" || node.type === "story-pro-starter") &&
    isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>)
  ) {
    const d = node.data as { scriptStudioMode?: boolean };
    return {
      mediaKind: d.scriptStudioMode ? "scriptStudioBatch" : "themeOutline",
    };
  }
  if (node.type === "story-pro2-starter" || node.type === "story-pro-starter") {
    return { mediaKind: "generalText" };
  }
  return {};
}

function resolveThreeViewCancelScope(
  node: CanvasFlowNode,
): Pick<CanvasCancelGenerationJob, "nodeId" | "rowKey" | "mediaKind" | "taskId"> {
  const d = node.data as {
    pro2ControllerNodeId?: string;
    pro2RowKey?: string;
    runtime?: { taskId?: string };
  };
  const controllerId = d.pro2ControllerNodeId?.trim();
  const rowKey = d.pro2RowKey?.trim();
  if (controllerId && rowKey) {
    return {
      nodeId: controllerId,
      rowKey,
      mediaKind: "threeView",
      taskId: d.runtime?.taskId?.trim(),
    };
  }
  return { nodeId: node.id, taskId: d.runtime?.taskId?.trim() };
}

function cancelJobsForNode(node: CanvasFlowNode): CanvasCancelGenerationJob[] {
  if (isAnyStoryScriptHubType(node.type ?? "")) {
    const jobs: CanvasCancelGenerationJob[] = [];
    for (const section of HUB_SECTIONS) {
      const rt = hubSectionRuntime(node, section);
      if (!isCanvasInflightStatus(rt?.status)) continue;
      jobs.push({
        nodeId: node.id,
        llmSection: section,
        taskId: rt?.taskId?.trim(),
      });
    }
    return jobs.length ? jobs : [{ nodeId: node.id }];
  }

  if (node.type === "story-pro2-starter" || node.type === "story-pro2-prompt" || node.type === "story-pro-starter") {
    const rt = (node.data as { themeOutlineRuntime?: { taskId?: string } })
      .themeOutlineRuntime;
    return [
      {
        nodeId: node.id,
        ...(node.type === "story-pro2-prompt"
          ? ({ mediaKind: "generalText" } as const)
          : resolveStarterCancelScope(node)),
        taskId: rt?.taskId?.trim(),
      },
    ];
  }

  if (node.type === "story-pro2-three-view") {
    const scope = resolveThreeViewCancelScope(node);
    return [{ ...scope, nodeId: scope.nodeId ?? node.id }];
  }

  if (
    node.type === "story-pro2-character" ||
    node.type === "story-pro2-frame" ||
    node.type === "story-pro2-video"
  ) {
    const d = node.data as {
      hubNodeId?: string;
      rows?: { key: string; runtime?: { status?: string; taskId?: string } }[];
    };
    const mediaKind =
      node.type === "story-pro2-character"
        ? ("threeView" as const)
        : node.type === "story-pro2-frame"
          ? ("frameImage" as const)
          : ("video" as const);
    const nodes = useCanvasStore.getState().nodes;
    const jobs: CanvasCancelGenerationJob[] = [];
    for (const row of d.rows ?? []) {
      const st = row.runtime?.status;
      if (st !== "pending" && st !== "running") continue;
      const scope = resolvePro2BoardRowCancelScope(nodes, {
        hubNodeId: d.hubNodeId,
        rowKey: row.key,
        mediaKind,
        taskId: row.runtime?.taskId,
      });
      if (scope) jobs.push(scope);
    }
    return jobs.length ? jobs : [{ nodeId: node.id }];
  }

  const rt = (node.data as { runtime?: { taskId?: string } }).runtime;
  return [{ nodeId: node.id, taskId: rt?.taskId?.trim() }];
}

/** 生成中扫光层 · 中止操作（须二次确认文案） */
export function useCanvasGenerationCancel(
  nodeId: string,
  scope?: Omit<CanvasCancelGenerationJob, "nodeId">,
) {
  const dialogs = useDialogs();

  const requestCancel = useCallback(async () => {
    if (
      !(await dialogs.confirm({
        title: GENERATION_CANCEL_CONFIRM_TITLE,
        message: GENERATION_CANCEL_CONFIRM_MESSAGE,
      }))
    ) {
      return;
    }

    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (scope) {
      busCancelCanvasGeneration({ nodeId, ...scope });
      return;
    }
    if (node) {
      for (const job of cancelJobsForNode(node)) {
        busCancelCanvasGeneration(job);
      }
      return;
    }
    busCancelCanvasGeneration({ nodeId });
  }, [dialogs, nodeId, scope]);

  return { requestCancel };
}
