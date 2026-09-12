"use client";

import {
  pickCanvasImageEditEngine,
  type CanvasImageEditModelKey,
} from "./canvas-image-edit-models";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import type { LibtvInpaintTool } from "./libtv-inpaint-session";
import type { CanvasFlowNode } from "./types";

/** 擦除 · Dock 固定提示词（用户不可改，与重绘共用 image-local-edit） */
export const LIBTV_ERASE_FIXED_DOCK_PROMPT =
  "擦除选区内的人物或物体，自然补全背景，保持画面其余部分不变。";

export type LibtvEraseSession = {
  active: boolean;
  tool: LibtvInpaintTool;
  brushSize: number;
  dockInputBefore?: string;
};

export const DEFAULT_ERASE_SESSION: LibtvEraseSession = {
  active: true,
  tool: "brush",
  brushSize: 24,
};

export function isLibtvEraseSessionActive(
  data: Record<string, unknown> | undefined,
): data is { libtvEraseSession: LibtvEraseSession } {
  const s = data?.libtvEraseSession as LibtvEraseSession | undefined;
  return Boolean(s?.active);
}

function patchEraseClear(node: CanvasFlowNode, nodeId: string): CanvasFlowNode {
  if (node.id !== nodeId) return node;
  const session = (node.data as { libtvEraseSession?: LibtvEraseSession })
    .libtvEraseSession;
  const data = { ...(node.data as Record<string, unknown>) };
  delete data.libtvEraseSession;
  delete data.libtvMagicEditGenerating;
  if (session?.dockInputBefore !== undefined) {
    data.dockInput = session.dockInputBefore;
  }
  return { ...node, data };
}

export function startLibtvEraseSession(
  sourceNodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  providers: CanvasProviderDto[],
): void {
  const engine = pickCanvasImageEditEngine(
    providers,
    "qwen-image-edit" as CanvasImageEditModelKey,
  );
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
      const dockInputBefore = String(
        (n.data as { dockInput?: string }).dockInput ?? "",
      );
      return {
        ...n,
        selected: true,
        data: {
          ...n.data,
          libtvEraseSession: { ...DEFAULT_ERASE_SESSION, dockInputBefore },
          dockInput: LIBTV_ERASE_FIXED_DOCK_PROMPT,
          engine: engine ?? (n.data as { engine?: unknown }).engine,
        },
      };
    }),
  );
}

export function clearLibtvEraseSession(
  nodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  rfSetNodes?: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  const apply = (prev: CanvasFlowNode[]) =>
    prev.map((n) => patchEraseClear(n, nodeId));
  setNodes(apply);
  rfSetNodes?.(apply);
}

export function patchLibtvEraseSession(
  nodeId: string,
  patch: Partial<LibtvEraseSession>,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const cur = (n.data as { libtvEraseSession?: LibtvEraseSession })
        .libtvEraseSession;
      if (!cur?.active) return n;
      return {
        ...n,
        data: {
          ...n.data,
          libtvEraseSession: { ...cur, ...patch },
        },
      };
    }),
  );
}
