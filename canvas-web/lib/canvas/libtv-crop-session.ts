"use client";

import { patchLibtvRfNodes, type LibtvRfSetNodes } from "./libtv-rf-node-patch";
import type { CanvasFlowNode } from "./types";

export type LibtvCropAspectRatio =
  | "original"
  | "1:1"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

export type LibtvCropSession = {
  active: boolean;
  aspectRatio: LibtvCropAspectRatio;
  dockInputBefore?: string;
};

export const DEFAULT_CROP_SESSION: LibtvCropSession = {
  active: true,
  aspectRatio: "original",
};

export function isLibtvCropSessionActive(
  data: Record<string, unknown> | undefined,
): data is { libtvCropSession: LibtvCropSession } {
  const s = data?.libtvCropSession as LibtvCropSession | undefined;
  return Boolean(s?.active);
}

function patchCropClear(node: CanvasFlowNode, nodeId: string): CanvasFlowNode {
  if (node.id !== nodeId) return node;
  const session = (node.data as { libtvCropSession?: LibtvCropSession })
    .libtvCropSession;
  const data = { ...(node.data as Record<string, unknown>) };
  delete data.libtvCropSession;
  delete data.libtvMagicEditGenerating;
  if (session?.dockInputBefore !== undefined) {
    data.dockInput = session.dockInputBefore;
  }
  return { ...node, data };
}

export function startLibtvCropSession(
  sourceNodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
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
          libtvCropSession: { ...DEFAULT_CROP_SESSION, dockInputBefore },
        },
      };
    }),
  );
}

export function clearLibtvCropSession(
  nodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  rfSetNodes?: LibtvRfSetNodes,
): void {
  const apply = (prev: CanvasFlowNode[]) =>
    prev.map((n) => patchCropClear(n, nodeId));
  setNodes(apply);
  patchLibtvRfNodes(rfSetNodes, apply);
}

export function patchLibtvCropSession(
  nodeId: string,
  patch: Partial<LibtvCropSession>,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const cur = (n.data as { libtvCropSession?: LibtvCropSession })
        .libtvCropSession;
      if (!cur?.active) return n;
      return {
        ...n,
        data: {
          ...n.data,
          libtvCropSession: { ...cur, ...patch },
        },
      };
    }),
  );
}
