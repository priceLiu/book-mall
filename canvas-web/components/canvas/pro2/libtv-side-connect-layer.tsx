"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { resolveLibtvSideConnectMenu } from "@/lib/canvas/libtv-side-connect-menu";
import { runLibtvSideConnectPick } from "@/lib/canvas/libtv-side-connect-pick";
import { useCanvasStore } from "@/lib/canvas/store";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";

const MENU_OFFSET_X = 12;

function LibtvSideConnectLayerInner() {
  const pending = useCanvasStore((s) => s.pendingSideConnect);
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const clearPendingSideConnect = useCanvasStore(
    (s) => s.clearPendingSideConnect,
  );
  const { alert, confirm } = useDialogs();

  const [lineTarget, setLineTarget] = useState<{ x: number; y: number } | null>(
    null,
  );

  const sourceNode = useMemo(
    () => (pending ? nodes.find((n) => n.id === pending.fromNodeId) : null),
    [pending, nodes],
  );

  const sections = useMemo(() => {
    if (!pending || !sourceNode?.type) return null;
    return resolveLibtvSideConnectMenu(
      String(sourceNode.type),
      pending.fromHandleId,
      sourceNode.data as Record<string, unknown> | undefined,
    );
  }, [pending, sourceNode?.type]);

  const menuAnchor = pending
    ? {
        x: pending.anchor.x + MENU_OFFSET_X,
        y: pending.anchor.y,
      }
    : null;

  useEffect(() => {
    if (pending) {
      setLineTarget({
        x: pending.anchor.x + MENU_OFFSET_X,
        y: pending.anchor.y,
      });
    } else {
      setLineTarget(null);
    }
  }, [pending]);

  const closeMenu = useCallback(() => {
    setLineTarget(null);
    clearPendingSideConnect();
  }, [clearPendingSideConnect]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, closeMenu]);

  const onPick = useCallback(
    (itemId: string, nodeType?: string) => {
      if (!pending) return;
      const store = {
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
        addNode,
        addNodeInGroup,
        setNodes,
        setEdges,
      };
      void runLibtvSideConnectPick(
        {
          fromNodeId: pending.fromNodeId,
          fromHandleId: pending.fromHandleId,
          screenAnchor: pending.anchor,
        },
        itemId,
        nodeType,
        store,
        { alert, confirm },
      ).finally(() => {
        closeMenu();
      });
    },
    [pending, addNode, addNodeInGroup, setNodes, setEdges, alert, confirm, closeMenu],
  );

  if (!pending || !sourceNode || !sections?.length || !menuAnchor || !lineTarget) {
    return null;
  }

  return (
    <>
      <Pro2AddNodePopover
        open
        anchor={menuAnchor}
        sections={sections}
        placement="beside-pointer"
        menuZIndex={2120}
        onClose={closeMenu}
        onPick={onPick}
        onPanelRect={(pt) => setLineTarget(pt)}
      />
    </>
  );
}

/** 单节点侧栏 + 拖线松手 · 落点菜单 + 预览线 */
export function LibtvSideConnectLayer() {
  const mounted = useClientPortalMounted();
  const pending = useCanvasStore((s) => s.pendingSideConnect);
  if (!mounted || !pending) return null;
  return createPortal(<LibtvSideConnectLayerInner />, document.body);
}
