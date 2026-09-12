"use client";

import { pickCanvasImageEditEngine } from "./canvas-image-edit-models";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import type { CanvasFlowNode } from "./types";

export type LibtvInpaintTool = "brush" | "rect" | "eraser";

export type LibtvInpaintSession = {
  active: boolean;
  tool: LibtvInpaintTool;
  brushSize: number;
  modelKey: string;
  dockInput: string;
  /** 进入重绘前源节点 dock 提示词 · 退出时恢复 */
  dockInputBeforeInpaint?: string;
};

export const DEFAULT_INPAINT_SESSION: LibtvInpaintSession = {
  active: true,
  tool: "rect",
  brushSize: 24,
  modelKey: "wan2.7-image-pro",
  dockInput: "在框选区域内按提示重绘，保持整体构图与风格一致。",
};

export function isLibtvInpaintSessionActive(
  data: Record<string, unknown> | undefined,
): data is { libtvInpaintSession: LibtvInpaintSession } {
  const s = data?.libtvInpaintSession as LibtvInpaintSession | undefined;
  return Boolean(s?.active);
}

function patchInpaintSessionClear(
  node: CanvasFlowNode,
  nodeId: string,
): CanvasFlowNode {
  if (node.id !== nodeId) return node;
  const session = (node.data as { libtvInpaintSession?: LibtvInpaintSession })
    .libtvInpaintSession;
  const data = { ...(node.data as Record<string, unknown>) };
  delete data.libtvInpaintSession;
  delete data.libtvInpaintGenerating;
  if (session?.dockInputBeforeInpaint !== undefined) {
    data.dockInput = session.dockInputBeforeInpaint;
  }
  return { ...node, data };
}

export function startLibtvInpaintSession(
  sourceNodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  providers: CanvasProviderDto[],
): void {
  // 默认框选 · 优先 wan2.7 bbox_list（空间位置准确）；无则回退 Qwen 蒙版
  const engine = pickCanvasImageEditEngine(providers, "wan2.7-image-pro");
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== sourceNodeId) {
        const keys = [
          "libtvInpaintSession",
          "libtvEraseSession",
          "libtvCropSession",
          "libtvExpandSession",
        ] as const;
        let data = { ...n.data } as Record<string, unknown>;
        let changed = false;
        for (const k of keys) {
          if (data[k]) {
            delete data[k];
            changed = true;
          }
        }
        return changed ? { ...n, data } : n;
      }
      const data = { ...(n.data as Record<string, unknown>) };
      delete data.libtvEraseSession;
      delete data.libtvCropSession;
      delete data.libtvExpandSession;
      const modelKey = engine?.modelKey ?? DEFAULT_INPAINT_SESSION.modelKey;
      const dockInputBeforeInpaint = String(
        (n.data as { dockInput?: string }).dockInput ?? "",
      );
      return {
        ...n,
        selected: true,
        data: {
          ...data,
          libtvInpaintSession: {
            ...DEFAULT_INPAINT_SESSION,
            modelKey,
            tool: "rect",
            dockInput: DEFAULT_INPAINT_SESSION.dockInput,
            dockInputBeforeInpaint,
          },
          engine: engine ?? (n.data as { engine?: unknown }).engine,
          dockInput: DEFAULT_INPAINT_SESSION.dockInput,
        },
      };
    }),
  );
}

export function clearLibtvInpaintSession(
  nodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  rfSetNodes?: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  const apply = (prev: CanvasFlowNode[]) =>
    prev.map((n) => patchInpaintSessionClear(n, nodeId));
  setNodes(apply);
  rfSetNodes?.(apply);
}

export function patchLibtvInpaintSession(
  nodeId: string,
  patch: Partial<LibtvInpaintSession>,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const cur = (n.data as { libtvInpaintSession?: LibtvInpaintSession })
        .libtvInpaintSession;
      if (!cur?.active) return n;
      return {
        ...n,
        data: {
          ...n.data,
          libtvInpaintSession: { ...cur, ...patch },
          ...(patch.dockInput !== undefined ? { dockInput: patch.dockInput } : {}),
          ...(patch.modelKey !== undefined
            ? {
                engine: {
                  ...(n.data as { engine?: { providerId?: string; params?: Record<string, unknown> } }).engine,
                  modelKey: patch.modelKey,
                },
              }
            : {}),
        },
      };
    }),
  );
}
