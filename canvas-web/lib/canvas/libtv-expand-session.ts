"use client";

import type { LibtvCropAspectRatio } from "./libtv-crop-session";
import { patchLibtvRfNodes, type LibtvRfSetNodes } from "./libtv-rf-node-patch";
import type { CanvasFlowNode } from "./types";

export type LibtvExpandAspectRatio = LibtvCropAspectRatio;

export type LibtvExpandSession = {
  active: boolean;
  aspectRatio: LibtvExpandAspectRatio;
  resolution: string;
  outputCount: number;
  dockInputBefore?: string;
  dockInput?: string;
};

export const DEFAULT_EXPAND_SESSION: LibtvExpandSession = {
  active: true,
  aspectRatio: "original",
  resolution: "2K",
  outputCount: 1,
  dockInput: "在保持原图主体不变的前提下向外扩图，补全画幅边缘。",
};

export function isLibtvExpandSessionActive(
  data: Record<string, unknown> | undefined,
): data is { libtvExpandSession: LibtvExpandSession } {
  const s = data?.libtvExpandSession as LibtvExpandSession | undefined;
  return Boolean(s?.active);
}

function patchExpandClear(node: CanvasFlowNode, nodeId: string): CanvasFlowNode {
  if (node.id !== nodeId) return node;
  const session = (node.data as { libtvExpandSession?: LibtvExpandSession })
    .libtvExpandSession;
  const data = { ...(node.data as Record<string, unknown>) };
  delete data.libtvExpandSession;
  delete data.libtvMagicEditGenerating;
  if (session?.dockInputBefore !== undefined) {
    data.dockInput = session.dockInputBefore;
  }
  return { ...node, data };
}

export function startLibtvExpandSession(
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
          libtvExpandSession: {
            ...DEFAULT_EXPAND_SESSION,
            dockInputBefore,
          },
          dockInput: DEFAULT_EXPAND_SESSION.dockInput,
        },
      };
    }),
  );
}

export function patchLibtvExpandSession(
  nodeId: string,
  patch: Partial<LibtvExpandSession>,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
): void {
  setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== nodeId) return n;
      const cur = (n.data as { libtvExpandSession?: LibtvExpandSession })
        .libtvExpandSession;
      if (!cur?.active) return n;
      return {
        ...n,
        data: {
          ...n.data,
          libtvExpandSession: { ...cur, ...patch },
        },
      };
    }),
  );
}

export function clearLibtvExpandSession(
  nodeId: string,
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  rfSetNodes?: LibtvRfSetNodes,
): void {
  const apply = (prev: CanvasFlowNode[]) =>
    prev.map((n) => patchExpandClear(n, nodeId));
  setNodes(apply);
  patchLibtvRfNodes(rfSetNodes, apply);
}
