"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Boxes,
  Clock,
  HelpCircle,
  Keyboard,
  Plus,
  Workflow,
  X,
} from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { handlePro2ToolbarAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  PRO2_ASSET_LIB_SUBMENU,
  PRO2_TOOLBAR_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { Sbv1Dock, type Sbv1DockItem } from "@/components/canvas/sbv1/sbv1-dock";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";
import { useDialogs } from "@/components/dialogs/dialog-provider";

export type Pro2CanvasToolbarProps = {
  onOpenStyleLibrary?: () => void;
};

/** 2.0 画布底部 Dock · 样式对齐分镜 1.0 `Sbv1Dock`，功能保持 Pro2 菜单逻辑 */
export function Pro2CanvasToolbar({
  onOpenStyleLibrary,
}: Pro2CanvasToolbarProps) {
  const { alert } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [assetAnchor, setAssetAnchor] = useState({ x: 0, y: 0 });

  const onToggleMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2 - 100, y: rect.top - 8 });
    setAssetMenuOpen(false);
    setMenuOpen((v) => !v);
  }, []);

  const onToggleAssetMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setAssetAnchor({ x: rect.left - 80, y: rect.top - 8 });
      setMenuOpen(false);
      setAssetMenuOpen((v) => !v);
    },
    [],
  );

  const onPick = useCallback(
    async (itemId: string, nodeType?: string) => {
      await handlePro2ToolbarAddNodePick(
        itemId,
        nodeType,
        { addNode, setNodes },
        { alert },
        { onOpenStyleLibrary },
      );
    },
    [addNode, setNodes, alert, onOpenStyleLibrary],
  );

  const dockItems = useMemo<Sbv1DockItem[]>(
    () => [
      {
        id: "add-nodes",
        name: menuOpen ? "关闭菜单" : "添加节点",
        icon: menuOpen ? (
          <X strokeWidth={1.75} />
        ) : (
          <Plus strokeWidth={1.75} />
        ),
        color: "bg-gradient-to-br from-violet-400 to-purple-600",
        active: menuOpen,
        onClick: onToggleMenu,
      },
      {
        id: "workflow",
        name: "节点",
        icon: <Workflow strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-zinc-500 to-zinc-700",
        disabled: true,
      },
      {
        id: "asset-lib",
        name: "素材库",
        icon: <Boxes strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-fuchsia-400 to-violet-600",
        active: assetMenuOpen,
        onClick: onToggleAssetMenu,
      },
      {
        id: "history",
        name: "生成记录",
        icon: <Clock strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-zinc-500 to-zinc-700",
        disabled: true,
      },
      {
        id: "shortcuts",
        name: "快捷键",
        icon: <Keyboard strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-zinc-500 to-zinc-700",
        disabled: true,
      },
      {
        id: "help",
        name: "帮助",
        icon: <HelpCircle strokeWidth={1.75} />,
        color: "bg-gradient-to-br from-zinc-500 to-zinc-700",
        disabled: true,
      },
    ],
    [menuOpen, assetMenuOpen, onToggleMenu, onToggleAssetMenu],
  );

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[70] flex justify-center px-4">
        <Sbv1Dock items={dockItems} />
      </div>
      <Pro2AddNodePopover
        open={menuOpen}
        anchor={{ x: anchor.x, y: anchor.y - 320 }}
        sections={PRO2_TOOLBAR_ADD_MENU}
        onClose={() => setMenuOpen(false)}
        onPick={onPick}
      />
      <Pro2AddNodePopover
        open={assetMenuOpen}
        anchor={{ x: assetAnchor.x, y: assetAnchor.y - 120 }}
        sections={PRO2_ASSET_LIB_SUBMENU}
        onClose={() => setAssetMenuOpen(false)}
        onPick={onPick}
      />
    </>
  );
}
