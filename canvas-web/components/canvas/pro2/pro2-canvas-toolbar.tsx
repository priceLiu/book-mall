"use client";

import { useCallback, useState } from "react";
import {
  Boxes,
  Clock,
  HelpCircle,
  Keyboard,
  Plus,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/canvas/store";
import { handlePro2ToolbarAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  PRO2_ASSET_LIB_SUBMENU,
  PRO2_TOOLBAR_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { Pro2AddNodePopover } from "./pro2-add-node-popover";
import { useDialogs } from "@/components/dialogs/dialog-provider";

export type Pro2CanvasToolbarProps = {
  onOpenStyleLibrary?: () => void;
};

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

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/12 bg-[#1c1c1e]/95 px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <button
            type="button"
            className={cn(
              "flex size-9 items-center justify-center rounded-xl transition",
              menuOpen
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/18",
            )}
            title={menuOpen ? "关闭" : "添加节点"}
            onClick={onToggleMenu}
          >
            {menuOpen ? <X className="size-4" /> : <Plus className="size-4" />}
          </button>
          <div className="mx-1 h-6 w-px bg-white/12" />
          <ToolbarIcon icon={Workflow} title="节点" disabled />
          <button
            type="button"
            className={cn(
              "relative flex size-8 items-center justify-center rounded-lg transition",
              assetMenuOpen
                ? "bg-white/14 text-white"
                : "text-white/55 hover:bg-white/8 hover:text-white/85",
            )}
            title="素材库"
            onClick={onToggleAssetMenu}
          >
            <Boxes className="size-4" />
            {assetMenuOpen ? (
              <span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-sky-400" />
            ) : null}
          </button>
          <ToolbarIcon icon={Clock} title="生成记录" disabled />
          <ToolbarIcon icon={Keyboard} title="快捷键" disabled />
          <ToolbarIcon icon={HelpCircle} title="帮助" disabled />
        </div>
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

function ToolbarIcon({
  icon: Icon,
  title,
  disabled,
}: {
  icon: typeof Plus;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className="flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/8 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon className="size-4" />
    </button>
  );
}
